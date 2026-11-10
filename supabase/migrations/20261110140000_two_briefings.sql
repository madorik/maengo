-- 하루 두 번 브리핑(2026-11-10 사용자): 오전 '출근길', 오후 '퇴근길'. 화면은 정해진 시각 없이 오전·오후로만 나누고,
-- 알림 시각은 오전·오후 기본값(07:00·18:00)을 두고 설정에서 바꾼다. 맹고-문서/맞춤-소식.md
-- 오후 소식은 같은 날짜 피드 뒤에 이어 붙인다(순번이 이어지고 feed_days.visible이 늘어난다). 그래서 보관함(library_page)은 그대로 쓴다.

-- 1) 오후 알림 시각
alter table public.profiles add column if not exists notify_at_pm time not null default '18:00';

-- 2) 피드 줄이 어느 브리핑 것인지
alter table public.feeds add column if not exists slot text not null default 'am';
alter table public.feeds drop constraint if exists feeds_slot_check;
alter table public.feeds add constraint feeds_slot_check check (slot in ('am', 'pm'));

-- 3) 배송 줄은 사람·날짜·브리핑마다 하나
alter table public.delivery_jobs add column if not exists slot text not null default 'am';
alter table public.delivery_jobs drop constraint if exists delivery_jobs_slot_check;
alter table public.delivery_jobs add constraint delivery_jobs_slot_check check (slot in ('am', 'pm'));
alter table public.delivery_jobs drop constraint if exists delivery_jobs_pkey;
alter table public.delivery_jobs add primary key (user_id, date, slot);

-- 4) 오후 알림 기록(같은 날 두 번째 푸시)
alter table public.notifications_log drop constraint if exists notifications_log_channel_check;
alter table public.notifications_log add constraint notifications_log_channel_check check (channel in ('push', 'push_pm', 'email'));

-- 5) 그날 줄 채우기: 오전(notify_at)·오후(notify_at_pm) 두 줄
create or replace function public.plan_deliveries(p_date date) returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.delivery_jobs (user_id, date, slot, build_at, notify_at)
    select p.id, p_date, s.slot,
           (p_date + s.at) at time zone 'Asia/Seoul',
           (p_date + s.at) at time zone 'Asia/Seoul'
    from public.profiles p
    cross join lateral (values ('am', p.notify_at), ('pm', p.notify_at_pm)) as s(slot, at)
    where p.onboarded_at is not null
    on conflict (user_id, date, slot) do update
      set build_at = excluded.build_at, notify_at = excluded.notify_at, updated_at = now()
      where public.delivery_jobs.status = 'pending'
        and public.delivery_jobs.notify_at <> excluded.notify_at
    returning 1
  )
  select count(*)::int from ins;
$$;
revoke execute on function public.plan_deliveries(date) from public, anon, authenticated;

create or replace function public.claim_build_jobs(p_now timestamptz, p_limit int) returns setof public.delivery_jobs
language sql security definer set search_path = '' as $$
  update public.delivery_jobs j
     set status = 'building', attempts = j.attempts + 1, updated_at = now()
   where (j.user_id, j.date, j.slot) in (
     select user_id, date, slot from public.delivery_jobs
      where status = 'pending' and build_at <= p_now
      order by build_at
      limit p_limit
      for update skip locked)
  returning j.*;
$$;

create or replace function public.claim_send_jobs(p_now timestamptz, p_limit int) returns setof public.delivery_jobs
language sql security definer set search_path = '' as $$
  update public.delivery_jobs j
     set status = 'sending', updated_at = now()
   where (j.user_id, j.date, j.slot) in (
     select user_id, date, slot from public.delivery_jobs
      where status = 'ready' and notify_at <= p_now
      order by notify_at
      limit p_limit
      for update skip locked)
  returning j.*;
$$;

-- 6) 오후 수집: 15:00 KST(오후 알림 기본 18:00보다 앞, 사용자가 오후 알림을 16:30까지 당겨도 새 글이 있게)
insert into public.scheduler_tasks (name, every_minutes, config, next_run_at)
select 'ingest_pm', 1440, config,
       (date_trunc('day', (now() at time zone 'Asia/Seoul') - interval '15 hours') + interval '1 day 15 hours') at time zone 'Asia/Seoul'
  from public.scheduler_tasks where name = 'ingest'
on conflict (name) do nothing;
