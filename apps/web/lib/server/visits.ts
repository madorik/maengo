import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db } from './db';

// 접속 기록(관리자 DAU·MAU). 로그인한 화면을 그릴 때 사람·한국 날짜마다 한 줄(visits).
// 같은 서버 인스턴스에서는 사람마다 하루 한 번만 쓴다. 데모 계정은 세지 않는다.
const seen = new Map<string, string>();

export async function recordVisit(userId: string): Promise<void> {
  const date = kstDate();
  if (seen.get(userId) === date) return;
  const { error } = await db.from('visits').upsert({ user_id: userId, date }, { onConflict: 'user_id,date', ignoreDuplicates: true });
  if (error) return void console.error('visits', error.message);
  if (seen.size > 10_000) seen.clear();
  seen.set(userId, date);
}
