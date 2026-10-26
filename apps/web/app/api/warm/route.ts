/**
 * GET → 204. API 함수(보관함 이어 붙이기 /api/library 등이 같이 도는 함수)를 식지 않게 깨우기만 한다. DB는 건드리지 않는다.
 * Supabase pg_cron이 2분마다 부른다(마이그레이션 20261026170100_keep_warm.sql). 화면 함수와 프록시는 같은 cron이 /login으로 깨운다
 */
export function GET() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
