-- 소식 지급·알림을 소식 만들기와 떼어 1분마다(2026-10-15 사용자 결정).
--   /api/cron/deliveries  1분   알림 시각이 된 사람 중 오늘 소식을 못 받은 사람에게만, 관심사에 맞는 소식을 골라(모자라면 석 달까지)
--                               그때 요약해 지급하고 알린다
--   /api/cron/scheduler   5분   scheduler_tasks: 3시간마다 수집·임베딩·묶기·태그·중복 합치기, 하루 정리. 요약은 미리 만들지 않는다
-- 여러 번 돌려도 같은 결과가 나오게 쓴다(네트워크 사정으로 대시보드·Management API에서 먼저 돌릴 수 있다).

-- 이미 오늘 소식을 받은 사람(처음 온 날 직접 받기 등)은 알리지 않고 had로 끝낸다
alter table public.delivery_jobs drop constraint if exists delivery_jobs_status_check;
alter table public.delivery_jobs add constraint delivery_jobs_status_check
  check (status in ('pending','building','ready','empty','had','sending','sent','no_device','muted','failed'));

-- 만들 시각 = 알림 시각(그때 골라 요약해 그 실행에서 보낸다. 예전엔 알림 30분 전에 수집·요약까지 했다)
create or replace function public.plan_deliveries(p_date date) returns int
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.delivery_jobs (user_id, date, build_at, notify_at)
    select p.id, p_date,
           (p_date + p.notify_at) at time zone 'Asia/Seoul',
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
revoke execute on function public.plan_deliveries(date) from public, anon, authenticated;

-- 아직 대기 중인 오늘 줄도 알림 시각에 만들게 맞춘다(다시 시도로 미룬 줄은 그대로)
update public.delivery_jobs set build_at = notify_at, updated_at = now()
 where status = 'pending' and last_error is null and build_at < notify_at;

-- 서버 스케줄러: 배송은 빼고(이 줄은 1분 실행의 잠금·결과 기록으로만 쓴다), 수집·임베딩은 3시간마다, 미리 요약은 끈다
update public.scheduler_tasks set enabled = false, every_minutes = 1 where name = 'deliveries';
update public.scheduler_tasks set every_minutes = 180, config = config || '{"embedLimit": 600}'::jsonb where name = 'ingest';
update public.scheduler_tasks set enabled = false where name = 'summarize';

-- 1분마다 /api/cron/deliveries(비밀값은 서버 스케줄러와 같은 vault cron_secret)
select cron.unschedule(jobid) from cron.job where jobname = 'maengo-deliveries';
select cron.schedule(
  'maengo-deliveries',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://maengo.vercel.app/api/cron/deliveries',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);
