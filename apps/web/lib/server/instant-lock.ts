import 'server-only';
import { db } from './db';

// '오늘 소식 받기'(api/feed/today)의 잠금(job_locks 'instant:<회원 id>'). 서버가 여러 대여도 한 사람의 만들기는 하나만 돈다.
// 오늘 화면은 살아 있는 잠금을 보고 '만드는 중'(emptyReason 'building')으로 보여 준다: 다른 탭·기기에서 눌렀거나, 만드는 중에 화면을 옮겼다 돌아온 때.

/** 함수 최대 시간(api/feed/today의 maxDuration 300초) + 여유. 이보다 오래된 잠금은 죽은 것으로 보고 넘겨받는다. maxDuration을 바꾸면 같이 바꾼다 */
export const INSTANT_LOCK_STALE_MS = (300 + 30) * 1000;

const keyOf = (userId: string) => `instant:${userId}`;

// 잡기·풀기는 파이프라인 잠금(@maengo/pipeline/lock)을 같이 쓴다(오래된 잠금은 started_at 조건을 건 update 한 번으로 넘겨받아 두 요청이 같이 잡지 않는다).
// 파이프라인은 불러올 때 환경 변수(GEMINI_API_KEY 등)를 읽어서, 오늘 화면(feed.ts → instantBuilding)이 같이 불러오지 않게 쓸 때만 불러온다.

/** 잠근다. 잡으면 이 잠금의 표(token, 풀 때 넘긴다), 다른 요청이 쥔 살아 있는 잠금이 있으면 null */
export async function lockInstant(userId: string): Promise<string | null> {
  const { tryLock } = await import('@maengo/pipeline/lock');
  return tryLock(keyOf(userId), INSTANT_LOCK_STALE_MS);
}

/** 푼다. 표가 같을 때만(늦게 끝나 그사이 다른 요청이 넘겨받은 잠금은 지우지 않는다). 실패해도 던지지 않는다 */
export async function unlockInstant(userId: string, token: string): Promise<void> {
  const { unlock } = await import('@maengo/pipeline/lock');
  await unlock(keyOf(userId), token);
}

/** 지금 이 사람의 '오늘 소식 받기'가 돌고 있는지(살아 있는 잠금). 못 읽으면 false(오늘 화면을 깨지 않게) */
export async function instantBuilding(userId: string): Promise<boolean> {
  const { data, error } = await db.from('job_locks').select('started_at').eq('key', keyOf(userId)).maybeSingle();
  if (error) {
    console.error('[instant] 잠금 읽기 실패', error.message);
    return false;
  }
  const row = data as { started_at: string } | null;
  return !!row && Date.now() - Date.parse(row.started_at) < INSTANT_LOCK_STALE_MS;
}
