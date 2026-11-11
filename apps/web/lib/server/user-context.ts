import 'server-only';
import { ASKED, CONTEXT_QUESTIONS, QUESTION_BY_KEY, SKIP, type UserContext } from '../context';
import { db, must } from './db';

// 내 맞춤 정보 읽기·쓰기와 오늘 물을 질문 고르기(lib/context.ts, 2026-11-11).
// 새 질문은 하루에 하나만('_asked'에 그날을 남긴다). 이어 묻는 질문(국내·미국, 청약)은 바로 묻는다


export async function getUserContext(userId: string): Promise<UserContext> {
  const rows = must(await db.from('user_context').select('key,value,updated_at').eq('user_id', userId), 'user_context') as { key: string; value: string; updated_at: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
}

/**
 * 답을 남긴다. value가 null이면 지운다. 앞 질문의 답이 바뀌어 이어 묻는 질문이 맞지 않게 되면(주식 → 안 해요) 그 답도 지운다.
 * day를 주면(소식을 보다 답할 때) 새 질문이면 오늘 물었다고 남긴다(새 질문은 하루에 하나)
 */
export async function setUserContext(userId: string, key: string, value: string | null, day?: string): Promise<boolean> {
  const q = QUESTION_BY_KEY.get(key);
  if (!q) return false;
  if (value !== null && value !== SKIP && !q.options.some((o) => o.value === value)) return false;
  const now = new Date().toISOString();
  if (value === null) must(await db.from('user_context').delete().eq('user_id', userId).eq('key', key), 'user_context delete');
  else must(await db.from('user_context').upsert({ user_id: userId, key, value, updated_at: now }, { onConflict: 'user_id,key' }), 'user_context upsert');
  // 이어 묻는 질문 정리
  for (const child of CONTEXT_QUESTIONS.filter((c) => c.after?.key === key)) {
    if (value !== child.after!.value) must(await db.from('user_context').delete().eq('user_id', userId).eq('key', child.key), 'user_context child delete');
  }
  if (day && !q.after) must(await db.from('user_context').upsert({ user_id: userId, key: ASKED, value: day, updated_at: now }, { onConflict: 'user_id,key' }), 'user_context asked');
  return true;
}

export { pickQuestion, type PickedQuestion } from '../context';
