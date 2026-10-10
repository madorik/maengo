-- 서버 스케줄러 작업 표(2026-10-11). pg_cron은 5분마다 /api/cron/scheduler를 부르기만 하고,
-- 서버가 이 표를 보고 차례가 된 작업만 돌린다. 주기·켜고 끄기·예산(config)은 이 표의 값만 바꾸면 된다.
--   deliveries  5분   알림 시각에 맹고 만들고 보내기(delivery_jobs)
--   ingest     30분   수집 → 임베딩 → 묶기 → 태그
--   summarize  30분   관심사 수요가 많은 소식부터 요약(config.summarizeLimit개), 중복 합치기
--   daily      하루   Premium 기한 정리(00:05 KST)
create table public.scheduler_tasks (
  name             text primary key,
  every_minutes    int not null check (every_minutes > 0),
  enabled          boolean not null default true,
  config           jsonb not null default '{}',
  next_run_at      timestamptz not null default now(),
  running_since    timestamptz,
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  last_status      text check (last_status in ('ok', 'failed')),
  last_error       text,
  last_stats       jsonb
);
alter table public.scheduler_tasks enable row level security;

insert into public.scheduler_tasks (name, every_minutes, config, next_run_at) values
  ('deliveries', 5, '{}', now()),
  ('ingest', 30, '{"embedLimit": 300}', now()),
  ('summarize', 30, '{"summarizeLimit": 10, "videoLimit": 0}', now() + interval '10 minutes'),
  ('daily', 1440, '{}', (date_trunc('day', now() at time zone 'Asia/Seoul') + interval '1 day 5 minutes') at time zone 'Asia/Seoul')
on conflict (name) do nothing;

-- 차례가 된 작업을 가져간다(다른 서버가 돌리는 중이면 건너뛰고, 10분 넘게 멈춘 것은 다시 가져간다)
create or replace function public.claim_scheduler_tasks(p_now timestamptz) returns setof public.scheduler_tasks
language sql security definer set search_path = '' as $$
  update public.scheduler_tasks t
     set running_since = now(), last_started_at = now()
   where t.name in (
     select name from public.scheduler_tasks
      where enabled and next_run_at <= p_now
        and (running_since is null or running_since < now() - interval '10 minutes')
      for update skip locked)
  returning t.*;
$$;

-- 끝난 작업을 기록하고 다음 차례를 정한다(원래 시각에 맞춰 주기만큼 뒤로, 밀렸으면 지난 차례는 건너뛴다)
create or replace function public.finish_scheduler_task(p_name text, p_status text, p_error text, p_stats jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.scheduler_tasks
     set running_since = null, last_finished_at = now(), last_status = p_status, last_error = p_error, last_stats = p_stats,
         next_run_at = next_run_at + (floor(extract(epoch from (now() - next_run_at)) / (every_minutes * 60)) + 1) * make_interval(mins => every_minutes)
   where name = p_name;
$$;

-- 시간이 모자라 이번에 못 돌린 작업을 놓아준다(다음 실행에서 바로 다시 차례)
create or replace function public.release_scheduler_task(p_name text) returns void
language sql security definer set search_path = '' as $$
  update public.scheduler_tasks set running_since = null where name = p_name;
$$;

revoke all on function public.claim_scheduler_tasks(timestamptz) from public, anon, authenticated;
revoke all on function public.finish_scheduler_task(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.release_scheduler_task(text) from public, anon, authenticated;
grant execute on function public.claim_scheduler_tasks(timestamptz) to service_role;
grant execute on function public.finish_scheduler_task(text, text, text, jsonb) to service_role;
grant execute on function public.release_scheduler_task(text) to service_role;

-- pg_cron은 이제 스케줄러 하나만 부른다
select cron.unschedule('maengo-deliveries') where exists (select 1 from cron.job where jobname = 'maengo-deliveries');
select cron.schedule(
  'maengo-scheduler',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://maengo.vercel.app/api/cron/scheduler',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);

create or replace function public.cron_status(p_limit int default 5)
returns table (started_at timestamptz, run_status text, message text, http_status int, http_at timestamptz)
language sql security definer set search_path = '' as $$
  with runs as (
    select d.start_time, d.status, d.return_message, row_number() over (order by d.start_time desc) as n
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'maengo-scheduler'
    order by d.start_time desc limit p_limit
  ), http as (
    select r.status_code, r.created, row_number() over (order by r.created desc) as n
    from net._http_response r order by r.created desc limit p_limit
  )
  select runs.start_time, runs.status, left(runs.return_message, 200), http.status_code, http.created
  from runs left join http on http.n = runs.n
  order by runs.start_time desc;
$$;
