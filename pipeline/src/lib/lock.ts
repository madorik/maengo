import { db } from './db';

// job_locks 잠금. 키 하나에 한 서버만 들어간다. staleMs보다 오래된 잠금은 죽은 것으로 보고 가져간다.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function tryLock(key: string, staleMs: number): Promise<boolean> {
  const { error } = await db.from('job_locks').insert({ key });
  if (!error) return true;
  if (error.code !== '23505') throw new Error(`job_locks: ${error.message}`);
  const { data: row } = await db.from('job_locks').select('started_at').eq('key', key).maybeSingle();
  if (row && Date.now() - Date.parse(row.started_at as string) < staleMs) return false;
  const { data } = await db.from('job_locks').upsert({ key, started_at: new Date().toISOString() }, { onConflict: 'key' }).select('key');
  return !!data?.length;
}

export async function unlock(key: string) {
  await db.from('job_locks').delete().eq('key', key);
}

/** 다른 서버가 쥔 잠금이 풀릴 때까지 기다린다(최대 maxMs) */
export async function waitUnlock(key: string, maxMs: number) {
  for (let waited = 0; waited < maxMs; waited += 2000) {
    await sleep(2000);
    const { data } = await db.from('job_locks').select('key').eq('key', key).maybeSingle();
    if (!data) return;
  }
}
