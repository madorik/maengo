-- pg_cron 실행 기록(cron.job_run_details)은 Supabase가 지우지 않아 10-10부터 약 6만 줄·31MB로 늘었다(1분·2분·5분마다 도는 작업 셋, 하루 약 1MB. 2026-11-11 성능 4번).
-- 7일 치만 남기고 매일 03:30(KST = UTC 18:30)에 지운다. 지금 쌓인 것도 한 번 지운다(지운 자리는 autovacuum 뒤 다시 쓰여 더 늘지 않는다)
delete from cron.job_run_details where end_time < now() - interval '7 days';

select cron.schedule(
  'maengo-cron-history-cleanup',
  '30 18 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
