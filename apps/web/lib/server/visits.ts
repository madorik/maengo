import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db } from './db';

// 접속 기록(관리자 DAU·MAU). 로그인한 화면을 그릴 때 사람·한국 날짜마다 한 줄(visits).
// 같은 서버 인스턴스에서는 사람마다 하루 한 번만 쓴다. 데모 계정은 세지 않는다.
// 마지막으로 앱을 연 때(profiles.last_seen_at)도 하루 한 번 고친다: 배송이 일주일 넘게 안 연 사람에겐 새로 요약하지 않는다(pipeline deliveries.ts)
const seen = new Map<string, string>();

export async function recordVisit(userId: string): Promise<void> {
  const date = kstDate();
  if (seen.get(userId) === date) return;
  const { error } = await db.from('visits').upsert({ user_id: userId, date }, { onConflict: 'user_id,date', ignoreDuplicates: true });
  if (error) return void console.error('visits', error.message);
  // 오늘(KST) 이미 고쳤으면 건너뛴다(서버 인스턴스가 여럿이어도 하루 한 번). 열이 없으면(마이그레이션 20261018192100 전) 로그만
  const dayStart = new Date(`${date}T00:00:00+09:00`).toISOString();
  const { error: seenError } = await db
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .or(`last_seen_at.is.null,last_seen_at.lt.${dayStart}`);
  if (seenError) console.error('profiles last_seen_at', seenError.message);
  if (seen.size > 10_000) seen.clear();
  seen.set(userId, date);
}
