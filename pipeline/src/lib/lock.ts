import { db } from './db';

// job_locks 잠금. 키 하나에 한 서버만 들어간다. staleMs보다 오래된 잠금은 죽은 것으로 보고 가져간다.
// 웹 "오늘 소식 받기"(apps/web/app/api/feed/today → lib/server/instant-lock.ts)도 이것을 쓴다(@maengo/pipeline/lock).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 잠금을 잡으면 그 잠금의 표(started_at, ISO 문자열), 못 잡으면 null. 표는 unlock에 넘긴다.
 * 오래된 잠금은 started_at 조건을 건 update 한 번으로 넘겨받는다: 두 요청이 같이 넘겨받지 않는다
 * (전엔 읽고 나서 upsert해서 둘 다 잡을 수 있었다, 2026-10-18 점검)
 */
export async function tryLock(key: string, staleMs: number): Promise<string | null> {
  const token = new Date().toISOString();
  const { error } = await db.from('job_locks').insert({ key, started_at: token });
  if (!error) return token;
  if (error.code !== '23505') throw new Error(`job_locks: ${error.message}`);
  const stale = new Date(Date.now() - staleMs).toISOString();
  const { data, error: takeError } = await db.from('job_locks').update({ started_at: token }).eq('key', key).lt('started_at', stale).select('key');
  if (takeError) throw new Error(`job_locks: ${takeError.message}`);
  return data?.length ? token : null;
}

/**
 * 잠금을 푼다. token(tryLock이 준 표)을 주면 내가 잡은 잠금일 때만 지운다: 오래 걸려 다른 요청이 넘겨받았으면 그쪽 잠금은 둔다.
 * 실패해도 던지지 않는다(잠금은 staleMs가 지나면 넘겨받는다)
 */
export async function unlock(key: string, token?: string | null) {
  let q = db.from('job_locks').delete().eq('key', key);
  if (token) q = q.eq('started_at', token);
  const { error } = await q;
  if (error) console.error(`[lock] ${key} 풀기 실패`, error.message);
}

/** 다른 서버가 쥔 잠금이 풀릴 때까지 기다린다(최대 maxMs) */
export async function waitUnlock(key: string, maxMs: number) {
  for (let waited = 0; waited < maxMs; waited += 2000) {
    await sleep(2000);
    const { data } = await db.from('job_locks').select('key').eq('key', key).maybeSingle();
    if (!data) return;
  }
}
