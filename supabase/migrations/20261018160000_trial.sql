-- 무료 체험(2026-10-18 사용자 결정): 처음 구독할 때만 7일 무료 체험. 결제 창을 띄우기 전에 앱 안 팝업으로
-- '체험이 끝나면 자동 결제'에 동의를 받고 그 기록을 남긴다. 체험 중에는 Premium을 주고 구독 상태를 trial로 둔다.
-- 해지했다가 다시 구독하면 체험 없이 바로 결제된다(스토어도 체험은 계정당 한 번).

-- 1. 구독 상태에 trial
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('trial', 'active', 'past_due', 'canceled'));

-- 2. 결제 기록에 기간 종류(RevenueCat period_type: trial | intro | normal)
alter table public.purchases add column if not exists period_type text;

create or replace function public.record_purchases(p jsonb) returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.purchases as t (user_id, store, transaction_id, original_transaction_id, rc_id, product_id, kind, period_type,
                                       purchased_at, expires_at, price, currency, price_usd, sandbox, refunded_at, source)
    select (e->>'user_id')::uuid, e->>'store', e->>'transaction_id', e->>'original_transaction_id', e->>'rc_id', e->>'product_id', e->>'kind', e->>'period_type',
           (e->>'purchased_at')::timestamptz, (e->>'expires_at')::timestamptz, (e->>'price')::numeric, e->>'currency', (e->>'price_usd')::numeric,
           coalesce((e->>'sandbox')::boolean, false), (e->>'refunded_at')::timestamptz, e->>'source'
    from jsonb_array_elements(p) e
    on conflict (store, transaction_id) do update set
      original_transaction_id = coalesce(excluded.original_transaction_id, t.original_transaction_id),
      rc_id = coalesce(excluded.rc_id, t.rc_id),
      period_type = coalesce(t.period_type, excluded.period_type),
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

-- 3. 체험 동의 기록: 결제 창을 띄우기 직전, 팝업에서 '동의하고 무료로 시작'을 누른 때. 보여 준 안내 문구를 그대로 남긴다
create table public.trial_consents (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  at         timestamptz not null default now(),
  product_id text not null,
  trial_days int  not null check (trial_days > 0),
  price      text not null,  -- 체험 뒤 결제 금액(스토어가 준 표시 그대로, 예: ₩3,800)
  charge_on  date not null,  -- 첫 결제 예정일(한국 날짜)
  platform   text,           -- ios | android
  notice     text not null   -- 동의할 때 보여 준 안내
);
create index trial_consents_user_at on public.trial_consents (user_id, at desc);
alter table public.trial_consents enable row level security;
