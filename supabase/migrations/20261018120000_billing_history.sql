-- 문의 대응용 이력(2026-10-18): 결제(purchases), RevenueCat 웹훅 원본(billing_events), 플랜 변경(plan_changes).
-- 맹고 지갑은 wallet_ledger가 이미 모든 들고 남(가입 선물·구매·더 받기·되돌림·관리자)을 남긴다. 구매는 ref 'rc:RevenueCat거래ID'로 purchases.rc_id와 이어진다.
-- 예전 포트원용 payments 표(쓰지 않음, 비어 있음)와 헷갈리지 않게 인앱 결제는 purchases에 둔다.
-- 세 표 모두 회원을 지우면 같이 지운다(개인정보 처리방침 3. 보유 기간). 서버(service role)만 읽고 쓴다.

-- 1. 결제: 거래 하나에 한 줄. 결제 동기화(/api/billing/sync)와 웹훅이 같은 거래를 여러 번 넣어도 한 줄로 합친다(record_purchases)
create table public.purchases (
  id                      bigserial primary key,
  user_id                 uuid not null references public.profiles on delete cascade,
  store                   text not null,  -- RevenueCat 스토어 이름(소문자): app_store, play_store, test_store, promotional …
  transaction_id          text not null,  -- 스토어 거래 ID(애플 거래 ID, 구글 주문 번호)
  original_transaction_id text,           -- 구독의 첫 거래(갱신은 모두 이것으로 묶인다)
  rc_id                   text,           -- RevenueCat 거래 ID(맹고 묶음. wallet_ledger.ref = 'rc:' || rc_id)
  product_id              text not null,
  kind                    text not null check (kind in ('subscription', 'pack', 'other')),
  purchased_at            timestamptz,
  expires_at              timestamptz,    -- 구독만
  price                   numeric,        -- 결제 통화 금액(웹훅·실제 스토어에만 있다)
  currency                text,
  price_usd               numeric,
  sandbox                 boolean not null default false,
  refunded_at             timestamptz,
  source                  text not null,  -- 처음 들어온 곳: sync | webhook:INITIAL_PURCHASE …
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (store, transaction_id)
);
create index purchases_user_at on public.purchases (user_id, purchased_at desc);
alter table public.purchases enable row level security;

-- 거래 여러 개를 넣는다. 이미 있으면 빈 칸만 채우고(가격은 웹훅에만 있다) 만료·환불은 새 값으로
create function public.record_purchases(p jsonb) returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.purchases as t (user_id, store, transaction_id, original_transaction_id, rc_id, product_id, kind,
                                      purchased_at, expires_at, price, currency, price_usd, sandbox, refunded_at, source)
    select (e->>'user_id')::uuid, e->>'store', e->>'transaction_id', e->>'original_transaction_id', e->>'rc_id', e->>'product_id', e->>'kind',
           (e->>'purchased_at')::timestamptz, (e->>'expires_at')::timestamptz, (e->>'price')::numeric, e->>'currency', (e->>'price_usd')::numeric,
           coalesce((e->>'sandbox')::boolean, false), (e->>'refunded_at')::timestamptz, e->>'source'
    from jsonb_array_elements(p) e
    on conflict (store, transaction_id) do update set
      original_transaction_id = coalesce(excluded.original_transaction_id, t.original_transaction_id),
      rc_id = coalesce(excluded.rc_id, t.rc_id),
      purchased_at = coalesce(t.purchased_at, excluded.purchased_at),
      expires_at = coalesce(excluded.expires_at, t.expires_at),
      price = coalesce(excluded.price, t.price),
      currency = coalesce(excluded.currency, t.currency),
      price_usd = coalesce(excluded.price_usd, t.price_usd),
      refunded_at = coalesce(excluded.refunded_at, t.refunded_at),
      updated_at = now()
    returning 1
  )
  select count(*)::int from ins;
$$;
revoke execute on function public.record_purchases(jsonb) from public, anon, authenticated;

-- 2. RevenueCat 웹훅 원본: 이벤트마다 한 줄(같은 이벤트가 다시 와도 한 줄). 구매·갱신·해지·만료·환불·결제 문제를 그대로 남긴다
create table public.billing_events (
  id             text primary key,  -- RevenueCat 이벤트 ID
  user_id        uuid references public.profiles on delete cascade,
  app_user_id    text,
  type           text not null,
  product_id     text,
  store          text,
  environment    text,              -- SANDBOX | PRODUCTION
  transaction_id text,
  event_at       timestamptz,
  received_at    timestamptz not null default now(),
  payload        jsonb not null
);
create index billing_events_user_at on public.billing_events (user_id, event_at desc);
alter table public.billing_events enable row level security;

-- 3. 플랜 변경: profiles.plan·premium_until이 바뀔 때마다 트리거가 남긴다(누가 어디서 바꿨든 빠짐없이).
--    이유는 같은 트랜잭션의 설정 maengo.plan_reason(set_plan·expire_premium이 넣는다). 없으면 가입 때 'signup', 그 밖엔 'db'(대시보드에서 직접 고침 등)
create table public.plan_changes (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  at         timestamptz not null default now(),
  from_plan  text,
  to_plan    text not null,
  from_until timestamptz,
  to_until   timestamptz,
  reason     text not null
);
create index plan_changes_user_at on public.plan_changes (user_id, at desc);
alter table public.plan_changes enable row level security;

create function public.log_plan_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.plan is not distinct from new.plan and old.premium_until is not distinct from new.premium_until then
    return null;
  end if;
  insert into public.plan_changes (user_id, from_plan, to_plan, from_until, to_until, reason)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.plan end,
    new.plan,
    case when tg_op = 'UPDATE' then old.premium_until end,
    new.premium_until,
    coalesce(nullif(current_setting('maengo.plan_reason', true), ''), case when tg_op = 'INSERT' then 'signup' else 'db' end)
  );
  return null;
end;
$$;
create trigger profiles_plan_history after insert or update of plan, premium_until on public.profiles
  for each row execute function public.log_plan_change();

-- 앱이 플랜을 바꿀 때 쓴다: 이유를 남기고 바꾼다. p_only_if가 있으면 지금 플랜이 그것일 때만(만료로 내릴 때 'plus'). 바꿨으면 true
create function public.set_plan(p_user uuid, p_plan text, p_until timestamptz, p_reason text, p_only_if text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform set_config('maengo.plan_reason', p_reason, true);
  update public.profiles set plan = p_plan, premium_until = p_until
  where id = p_user and (p_only_if is null or plan = p_only_if);
  get diagnostics v_n = row_count;
  perform set_config('maengo.plan_reason', '', true);
  return v_n > 0;
end;
$$;
revoke execute on function public.set_plan(uuid, text, timestamptz, text, text) from public, anon, authenticated;

-- 새벽 배치의 만료 처리도 이유를 남긴다(하는 일은 그대로)
create or replace function public.expire_premium() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform set_config('maengo.plan_reason', 'expiry_batch', true);
  update public.profiles set plan = 'free', premium_until = null
  where plan = 'plus' and premium_until is not null and premium_until < now();
  get diagnostics v_n = row_count;
  perform set_config('maengo.plan_reason', '', true);
  return v_n;
end;
$$;
revoke execute on function public.expire_premium() from public, anon, authenticated;
