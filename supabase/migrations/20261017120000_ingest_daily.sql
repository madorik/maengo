-- 수집·임베딩·묶기·태그(ingest)를 3시간마다 → 하루 한 번 06:00 KST(2026-10-17 사용자 결정). 알림이 가장 이른 사람이 07시라 그 전에 끝나게.
-- 회당 상한(embedLimit 600)은 그대로라 임베딩이 하루 최대 600개로 준다(3시간마다일 때 하루 약 2,100~3,100개, 2026-10-17 실측).
-- next_run_at은 다음 06:00 KST. 그 뒤로는 finish_scheduler_task가 이 시각에 맞춰 하루씩 민다.
update public.scheduler_tasks
   set every_minutes = 1440,
       next_run_at = (date_trunc('day', (now() at time zone 'Asia/Seoul') - interval '6 hours') + interval '1 day 6 hours') at time zone 'Asia/Seoul'
 where name = 'ingest';
