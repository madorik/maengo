-- 알림 시각에 맹고를 만들고 보내는 일을 사람·날짜마다 한 줄로 관리한다(스케줄 표, 2026-10-11).
-- 서버(/api/cron/deliveries)가 5분마다 돌며: 오늘 줄 채우기 → 만들 시각이 된 줄 만들기 → 보낼 시각이 된 줄 보내기.
create table public.delivery_jobs (
  user_id    uuid not null references public.profiles on delete cascade,
  date       date not null,                -- 피드 날짜(KST)
  build_at   timestamptz not null,         -- 이때부터 만든다(알림 30분 전)
  notify_at  timestamptz not null,         -- 이때 보낸다(사용자가 고른 알림 시각)
  status     text not null default 'pending'
             check (status in ('pending','building','ready','empty','sending','sent','no_device','failed')),
  attempts   int not null default 0,
  last_error text,
  built_at   timestamptz,
  sent_at    timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create index delivery_jobs_build_idx on public.delivery_jobs (status, build_at);
create index delivery_jobs_notify_idx on public.delivery_jobs (status, notify_at);
alter table public.delivery_jobs enable row level security;

-- 그날 줄을 채운다(관심사를 고른 사람 모두). 알림 시각을 바꿨으면 아직 대기 중인 줄의 시각도 맞춘다
create or replace function public.plan_deliveries(p_date date) returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.delivery_jobs (user_id, date, build_at, notify_at)
    select p.id, p_date,
           ((p_date + p.notify_at) at time zone 'Asia/Seoul') - interval '30 minutes',
           (p_date + p.notify_at) at time zone 'Asia/Seoul'
    from public.profiles p
    where p.onboarded_at is not null
    on conflict (user_id, date) do update
      set build_at = excluded.build_at, notify_at = excluded.notify_at, updated_at = now()
      where public.delivery_jobs.status = 'pending'
        and public.delivery_jobs.notify_at <> excluded.notify_at
    returning 1
  )
  select count(*)::int from ins;
$$;

-- 만들 시각이 된 줄을 가져간다(여러 서버가 동시에 돌아도 한 줄은 한 번만)
create or replace function public.claim_build_jobs(p_now timestamptz, p_limit int) returns setof public.delivery_jobs
language sql security definer set search_path = '' as $$
  update public.delivery_jobs j
     set status = 'building', attempts = j.attempts + 1, updated_at = now()
   where (j.user_id, j.date) in (
     select user_id, date from public.delivery_jobs
      where status = 'pending' and build_at <= p_now
      order by build_at
      limit p_limit
      for update skip locked)
  returning j.*;
$$;

-- 보낼 시각이 된 줄을 가져간다
create or replace function public.claim_send_jobs(p_now timestamptz, p_limit int) returns setof public.delivery_jobs
language sql security definer set search_path = '' as $$
  update public.delivery_jobs j
     set status = 'sending', updated_at = now()
   where (j.user_id, j.date) in (
     select user_id, date from public.delivery_jobs
      where status = 'ready' and notify_at <= p_now
      order by notify_at
      limit p_limit
      for update skip locked)
  returning j.*;
$$;

-- 서버가 죽어 10분 넘게 '만드는 중'·'보내는 중'에 멈춘 줄을 되돌린다(세 번 실패하면 failed)
create or replace function public.reclaim_stuck_deliveries() returns int
language sql security definer set search_path = '' as $$
  with u as (
    update public.delivery_jobs
       set status = case when status = 'sending' then 'ready'
                         when attempts >= 3 then 'failed'
                         else 'pending' end,
           last_error = coalesce(last_error, '멈춰서 되돌림'), updated_at = now()
     where status in ('building', 'sending') and updated_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::int from u;
$$;

revoke all on function public.plan_deliveries(date) from public, anon, authenticated;
revoke all on function public.claim_build_jobs(timestamptz, int) from public, anon, authenticated;
revoke all on function public.claim_send_jobs(timestamptz, int) from public, anon, authenticated;
revoke all on function public.reclaim_stuck_deliveries() from public, anon, authenticated;
grant execute on function public.plan_deliveries(date) to service_role;
grant execute on function public.claim_build_jobs(timestamptz, int) to service_role;
grant execute on function public.claim_send_jobs(timestamptz, int) to service_role;
grant execute on function public.reclaim_stuck_deliveries() to service_role;
