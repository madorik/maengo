-- 맹고 묶음 환불 회수와 구매 지급 한 번만(2026-10-18 점검).
-- 1. 스토어가 맹고 묶음을 환불하면(RevenueCat CANCELLATION 웹훅. 구글 무효 구매도 같은 이벤트로 온다) 그 구매로 넣은 맹고를 한 번 뺀다.
--    이유 'chargeback'(환불 회수), ref는 구매와 같은 'rc:RevenueCat거래ID'. 이미 쓴 맹고는 되돌릴 수 없어서 잔액은 0 밑으로 내리지 않고,
--    실제로 뺀 만큼만 기록한다(기록 합계 = 잔액). 넣기 전에 환불되면 0맹고 기록만 남겨 뒤늦게 넣지 않게 한다.
-- 2. 구매 지급은 스토어 거래 하나에 한 번(회원과 상관없이). 전에는 (회원, 이유, ref)마다 한 번이라, 구매가 다른 회원에게 옮겨 가면
--    (RevenueCat 복원·이전) 그 회원이 같은 거래로 또 받았다. ref와 스토어 거래(store_tx = '스토어:거래ID', purchases의 store·transaction_id)를
--    구매 행 안에서 유일하게 둔다.
--    ⚠ 이미 두 회원이 같은 거래로 받은 행이 있으면 아래 인덱스 만들기가 실패한다. 적용 전에 확인:
--      select ref, count(*) from public.wallet_ledger where reason = 'purchase' group by ref having count(*) > 1;
--    나오면 문의 대응처럼 한쪽을 정리(관리자 차감 등)한 뒤 적용한다.

alter table public.wallet_ledger drop constraint if exists wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check check (reason in ('signup', 'purchase', 'more', 'refund', 'admin', 'chargeback'));

-- 스토어 거래(구매·환불 회수 행만). 웹훅은 RevenueCat 거래 ID 없이 스토어 거래 ID만 줘서 환불을 이것으로 찾는다
alter table public.wallet_ledger add column if not exists store_tx text;
update public.wallet_ledger l set store_tx = p.store || ':' || p.transaction_id
from public.purchases p
where l.reason = 'purchase' and l.store_tx is null and p.rc_id is not null and l.ref = 'rc:' || p.rc_id;

create unique index if not exists wallet_ledger_purchase_ref on public.wallet_ledger (ref) where reason = 'purchase';
create unique index if not exists wallet_ledger_purchase_tx on public.wallet_ledger (store_tx) where reason = 'purchase' and store_tx is not null;
create unique index if not exists wallet_ledger_chargeback_ref on public.wallet_ledger (ref) where reason = 'chargeback';
create unique index if not exists wallet_ledger_chargeback_tx on public.wallet_ledger (store_tx) where reason = 'chargeback' and store_tx is not null;

-- 구매·운영 지급: 지갑에 더한다. 같은 거래는 누구에게든 한 번만(ref·store_tx), 환불로 회수한 거래는 다시 넣지 않는다.
-- 인자가 하나 늘어 예전 함수는 지운다(같은 이름이 둘이면 PostgREST가 고르지 못한다). p_store_tx가 없으면 ref로만 본다
drop function if exists public.wallet_credit(uuid, int, text, text);
create function public.wallet_credit(p_user uuid, p_n int, p_reason text, p_ref text, p_store_tx text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_n <= 0 or p_reason not in ('purchase', 'admin') then
    raise exception 'bad_credit';
  end if;
  -- 같은 거래의 넣기·회수가 동시에 와도 차례로(회수가 먼저 끝났으면 넣지 않는다)
  perform pg_advisory_xact_lock(hashtext('wallet_tx:' || coalesce(p_store_tx, p_ref)));
  if p_reason = 'purchase' and exists (
    select 1 from public.wallet_ledger where reason = 'chargeback' and (ref = p_ref or (p_store_tx is not null and store_tx = p_store_tx))
  ) then
    return false;
  end if;
  if p_reason = 'purchase' and p_store_tx is not null and exists (
    select 1 from public.wallet_ledger where reason = 'purchase' and store_tx = p_store_tx
  ) then
    return false;
  end if;
  perform 1 from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'no_wallet';
  end if;
  -- 대상 없이: (회원, 이유, ref)와 ref·store_tx 유일 인덱스 중 어느 것에 걸려도 넣지 않는다
  insert into public.wallet_ledger (user_id, reason, delta, ref, store_tx)
  values (p_user, p_reason, p_n, p_ref, case when p_reason = 'purchase' then p_store_tx end)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  update public.wallets set balance = balance + p_n, updated_at = now() where user_id = p_user;
  return true;
end;
$$;

-- 환불 회수: 스토어 거래(p_store_tx) 또는 RevenueCat 거래(p_ref)로 넣은 맹고를 받은 회원에게서 한 번 뺀다(잔액까지만).
-- 아직 넣지 않았으면 p_user(웹훅의 회원)에게 0맹고 기록만 남긴다. 뺀 맹고 수를 돌려준다(이미 회수했으면 null)
create function public.wallet_chargeback(p_user uuid, p_store_tx text, p_ref text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_granted int;
  v_ref text;
  v_balance int;
  v_take int;
begin
  if p_store_tx is null and p_ref is null then
    raise exception 'bad_chargeback';
  end if;
  perform pg_advisory_xact_lock(hashtext('wallet_tx:' || coalesce(p_store_tx, p_ref)));
  select user_id, delta, ref into v_owner, v_granted, v_ref from public.wallet_ledger
  where reason = 'purchase' and ((p_store_tx is not null and store_tx = p_store_tx) or (p_ref is not null and ref = p_ref))
  limit 1;
  if exists (
    select 1 from public.wallet_ledger
    where reason = 'chargeback' and ((p_store_tx is not null and store_tx = p_store_tx) or ref = coalesce(v_ref, p_ref, 'tx:' || p_store_tx))
  ) then
    return null;
  end if;
  if v_owner is null then
    -- 지운 회원 등 우리 회원이 아니면 남길 곳이 없다
    if not exists (select 1 from public.profiles where id = p_user) then
      return 0;
    end if;
    insert into public.wallet_ledger (user_id, reason, delta, ref, store_tx) values (p_user, 'chargeback', 0, coalesce(p_ref, 'tx:' || p_store_tx), p_store_tx)
    on conflict do nothing;
    return 0;
  end if;
  select balance into v_balance from public.wallets where user_id = v_owner for update;
  v_take := greatest(0, least(v_granted, coalesce(v_balance, 0)));
  insert into public.wallet_ledger (user_id, reason, delta, ref, store_tx) values (v_owner, 'chargeback', -v_take, v_ref, p_store_tx)
  on conflict do nothing;
  if not found then
    return null;
  end if;
  update public.wallets set balance = balance - v_take, updated_at = now() where user_id = v_owner;
  return v_take;
end;
$$;

revoke all on function public.wallet_credit(uuid, int, text, text, text) from public, anon, authenticated;
revoke all on function public.wallet_chargeback(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wallet_credit(uuid, int, text, text, text) to service_role;
grant execute on function public.wallet_chargeback(uuid, text, text) to service_role;
