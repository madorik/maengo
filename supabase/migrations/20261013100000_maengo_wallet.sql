-- 맹고 지갑과 더 받기(2026-10-14). 1맹고 = 오늘 맹고 하나 더 받기.
-- 매일 주는 맹고(Free 2·Premium 10)는 그날만 쓰고 넘기지 않아서 따로 저장하지 않는다(feed_days.extra로 센다).
-- 이 지갑에는 사라지지 않는 맹고만 둔다: 가입 선물과 산 맹고. 숫자는 packages/core/src/plans.ts가 정해 인자로 넘긴다.
-- 표는 모두 서버 키로만 읽고 쓴다(정책 없음).

create table public.wallets (
  user_id    uuid primary key references public.profiles on delete cascade,
  balance    int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;

-- 들고 난 기록. 같은 (사람, 이유, ref)는 한 번만 들어가서 같은 일을 두 번 해도 한 번만 반영된다
create table public.wallet_ledger (
  id      bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  at      timestamptz not null default now(),
  reason  text not null check (reason in ('signup', 'purchase', 'more', 'refund', 'admin')),
  delta   int not null,
  ref     text not null,  -- signup | 거래 ID(구매) | 'YYYY-MM-DD:n:임의값'(더 받기·되돌림)
  unique (user_id, reason, ref)
);
create index wallet_ledger_user_at on public.wallet_ledger (user_id, at desc);
alter table public.wallet_ledger enable row level security;

-- 오늘 더 받은 개수(매일 맹고 + 지갑에서 쓴 것). 보여 줄 개수 = min(고른 소식 수, 플랜 기본 + extra)
alter table public.feed_days add column extra int not null default 0 check (extra >= 0);
alter table public.feed_days drop constraint if exists feed_days_visible_check;
alter table public.feed_days add constraint feed_days_visible_check check (visible >= 0);
alter table public.feeds drop constraint if exists feeds_rank_check;
alter table public.feeds add constraint feeds_rank_check check (rank >= 1);

-- 지갑을 읽는다. 없으면 만들고 가입 선물 맹고를 한 번 준다
create or replace function public.wallet_sync(p_user uuid, p_signup int)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_balance int;
begin
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance into v_balance from public.wallets where user_id = p_user for update;
  insert into public.wallet_ledger (user_id, reason, delta, ref) values (p_user, 'signup', p_signup, 'signup')
  on conflict (user_id, reason, ref) do nothing;
  if found then
    update public.wallets set balance = balance + p_signup, updated_at = now() where user_id = p_user returning balance into v_balance;
  end if;
  return v_balance;
end;
$$;

-- 더 받기: p_n맹고를 뺀다. 모자라면 ok=false
create or replace function public.wallet_spend(p_user uuid, p_n int, p_ref text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_balance int;
begin
  if p_n <= 0 then
    raise exception 'bad_amount';
  end if;
  select balance into v_balance from public.wallets where user_id = p_user for update;
  if v_balance is null or v_balance < p_n then
    return jsonb_build_object('ok', false, 'balance', coalesce(v_balance, 0));
  end if;
  insert into public.wallet_ledger (user_id, reason, delta, ref) values (p_user, 'more', -p_n, p_ref);
  update public.wallets set balance = balance - p_n, updated_at = now() where user_id = p_user returning balance into v_balance;
  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

-- 더 받기를 못 하게 됐을 때(소식을 못 붙임) 뺀 만큼 돌려준다. 한 번만
create or replace function public.wallet_refund(p_user uuid, p_ref text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_delta int;
begin
  select delta into v_delta from public.wallet_ledger where user_id = p_user and reason = 'more' and ref = p_ref;
  if v_delta is null then
    return false;
  end if;
  perform 1 from public.wallets where user_id = p_user for update;
  insert into public.wallet_ledger (user_id, reason, delta, ref) values (p_user, 'refund', -v_delta, p_ref)
  on conflict (user_id, reason, ref) do nothing;
  if not found then
    return false;
  end if;
  update public.wallets set balance = balance - v_delta, updated_at = now() where user_id = p_user;
  return true;
end;
$$;

-- 구매·운영 지급: 지갑에 더한다. 같은 거래(ref)는 한 번만. 지갑은 wallet_sync로 먼저 만들어 둔다
create or replace function public.wallet_credit(p_user uuid, p_n int, p_reason text, p_ref text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_n <= 0 or p_reason not in ('purchase', 'admin') then
    raise exception 'bad_credit';
  end if;
  perform 1 from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'no_wallet';
  end if;
  insert into public.wallet_ledger (user_id, reason, delta, ref) values (p_user, p_reason, p_n, p_ref)
  on conflict (user_id, reason, ref) do nothing;
  if not found then
    return false;
  end if;
  update public.wallets set balance = balance + p_n, updated_at = now() where user_id = p_user;
  return true;
end;
$$;

revoke all on function public.wallet_sync(uuid, int) from public, anon, authenticated;
revoke all on function public.wallet_spend(uuid, int, text) from public, anon, authenticated;
revoke all on function public.wallet_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_credit(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.wallet_sync(uuid, int) to service_role;
grant execute on function public.wallet_spend(uuid, int, text) to service_role;
grant execute on function public.wallet_refund(uuid, text) to service_role;
grant execute on function public.wallet_credit(uuid, int, text, text) to service_role;

-- 인앱 결제(RevenueCat): 운영자가 준 권한(promotional)도 구독 표에 남긴다
alter table public.subscriptions drop constraint if exists subscriptions_store_check;
alter table public.subscriptions add constraint subscriptions_store_check check (store in ('portone', 'app_store', 'play', 'promotional'));
