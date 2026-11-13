import 'server-only';
import { ASKED, CONTEXT_QUESTIONS, PERSONAL_OFF, QUESTION_BY_KEY, SKIP, valuesOf, type ContextQuestion, type UserContext } from '../context';
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
  // 고른 값이 질문의 선택지인지(여러 개를 고르는 질문은 쉼표로 이은 값 하나하나, 겹치면 안 된다)
  if (value !== null && value !== SKIP) {
    const parts = q.multi ? value.split(',') : [value];
    if (!parts.length || new Set(parts).size !== parts.length || !parts.every((v) => q.options.some((o) => o.value === v))) return false;
    if (q.max && parts.length > q.max) return false;
  }
  const now = new Date().toISOString();
  if (value === null) must(await db.from('user_context').delete().eq('user_id', userId).eq('key', key), 'user_context delete');
  else must(await db.from('user_context').upsert({ user_id: userId, key, value, updated_at: now }, { onConflict: 'user_id,key' }), 'user_context upsert');
  // 이어 묻는 질문 정리
  for (const child of CONTEXT_QUESTIONS.filter((c) => c.after?.key === key)) {
    if (value !== child.after!.value) must(await db.from('user_context').delete().eq('user_id', userId).eq('key', child.key), 'user_context child delete');
  }
  if (day && !q.after) must(await db.from('user_context').upsert({ user_id: userId, key: ASKED, value: day, updated_at: now }, { onConflict: 'user_id,key' }), 'user_context asked');
  // 관심사 비중은 덤이라 실패해도(예: 운영 DB에 아직 없는 관심사) 답은 그대로 둔다
  await syncTopics(userId, q, value).catch((e) => console.error('[user-context] 관심사 비중 맞추기 실패', String((e as Error)?.message ?? e).slice(0, 200)));
  return true;
}

/**
 * 칩에 상세 관심사가 걸려 있으면(예: 경제 '세금·정책' → tax-policy) 고른 것은 비중을 켜고(1, 이미 있으면 그대로) 뺀 것은 지운다(2026-11-12).
 * 그래서 그 주제 소식을 브리핑에서 더 받는다(분야 비중과 함께 rankFeed가 본다)
 */
async function syncTopics(userId: string, q: ContextQuestion, value: string | null): Promise<void> {
  const linked = q.options.filter((o) => o.topic);
  if (!linked.length) return;
  const chosen = new Set(valuesOf(q, value ?? undefined));
  const on = [...new Set(linked.filter((o) => chosen.has(o.value)).map((o) => o.topic!))];
  // 같은 관심사에 칩이 여럿 걸리면(AI 서비스·AI 투자 → ai) 하나라도 고르면 켠 채로 둔다
  const off = [...new Set(linked.filter((o) => !chosen.has(o.value)).map((o) => o.topic!))].filter((t) => !on.includes(t));
  if (on.length)
    must(
      await db.from('user_topics').upsert(on.map((topic_id) => ({ user_id: userId, topic_id, weight: 1, source: 'settings' })), { onConflict: 'user_id,topic_id', ignoreDuplicates: true }),
      'user_topics context on',
    );
  if (off.length) must(await db.from('user_topics').delete().eq('user_id', userId).in('topic_id', off), 'user_topics context off');
}

/** '맞춤 인사이트' 켜고 끄기(설정). 끄면 회원 정보를 오늘의 흐름에 쓰지 않고 질문도 하지 않는다. 이미 받은 답은 그대로 둔다(지우기는 설정 > 맞춤 인사이트 > 내 맞춤 정보에서) */
export async function setPersonalInsight(userId: string, on: boolean): Promise<void> {
  if (on) must(await db.from('user_context').delete().eq('user_id', userId).eq('key', PERSONAL_OFF), 'user_context personal on');
  else must(await db.from('user_context').upsert({ user_id: userId, key: PERSONAL_OFF, value: '1', updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' }), 'user_context personal off');
}

export { pickQuestion, type PickedQuestion } from '../context';
