-- 웹 함수가 식지 않게 2분마다 깨운다(2026-10-26 사용자 결정: 보관함 느림 점검에서 1번).
-- 운영 배포는 함수가 넷이다: 화면(/library·/today 등), API(/api/library 등), cron(1분마다 부르는 /api/cron/* 라 늘 깨어 있음),
-- 프록시(로그인 확인 proxy.ts, Vercel이 해외 8개 지역에만 둔다). 오래 쉬면 화면·API·프록시가 식어 첫 요청이 1초 넘게 걸렸다.
--   /maengo/login     프록시 + 화면 함수(로그인 쿠키가 없어 DB·인증 서버를 부르지 않는다)
--   /maengo/api/warm  API 함수(204만 돌려준다)
-- 보내기만 하고 응답은 보지 않는다(pg_net). 여러 번 돌려도 같은 결과가 나오게 쓴다.
select cron.unschedule(jobid) from cron.job where jobname = 'maengo-keep-warm';
select cron.schedule(
  'maengo-keep-warm',
  '*/2 * * * *',
  $cron$
  select net.http_get(url := 'https://maengo.vercel.app/maengo/login', timeout_milliseconds := 10000);
  select net.http_get(url := 'https://maengo.vercel.app/maengo/api/warm', timeout_milliseconds := 10000);
  $cron$
);
