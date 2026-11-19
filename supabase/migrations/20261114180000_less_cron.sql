-- Vercel Hobby 한도(Active CPU 30일 4시간)에 거의 닿아 백그라운드 호출을 줄인다(2026-11-14 사용자 결정).
--   1) 2분마다 깨우기(maengo-keep-warm: /maengo/login + /maengo/api/warm)를 끈다. 오래 쉬면 첫 요청이 1초 넘게 걸릴 수 있다.
--      다시 켜려면 20261026170100_keep_warm.sql을 다시 돌린다
--   2) 배송(/api/cron/deliveries)을 1분 → 5분마다. claim_build_jobs·claim_send_jobs가 `<= now`로 고르므로
--      빠지는 사람은 없고 알림이 최대 5분 늦어진다
-- 여러 번 돌려도 같은 결과가 나오게 쓴다(Management API로 먼저 돌릴 수 있다).
select cron.unschedule(jobid) from cron.job where jobname = 'maengo-keep-warm';
select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname = 'maengo-deliveries';
