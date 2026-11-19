/**
 * GET → 204. API 함수(보관함 이어 붙이기 /api/library 등이 같이 도는 함수)를 식지 않게 깨우기만 한다. DB는 건드리지 않는다.
 * 2026-11-14부터 부르지 않는다(Vercel Hobby 한도 때문에 깨우기 끔, 20261114180000_less_cron.sql). 예전엔 pg_cron이 2분마다 불렀다(20261026170100_keep_warm.sql)
 */
export function GET() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
