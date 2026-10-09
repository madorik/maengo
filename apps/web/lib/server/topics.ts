import 'server-only';
import { modelForPlan } from '@maengo/core/ai';
import { josa } from '@maengo/core/josa';
import { kstDate } from '@maengo/core/kst';
import { JOB_TOPICS, TOPIC_BY_ID, TOPICS } from '@maengo/core/topics';
import { ai } from './ai';
import type { TopicResult, UserTopic } from '../types';
import { entitlements, store, weightsOf, type Profile } from './store';

// 관심 토픽 고치기(설정). 바꾼 내용은 다음 피드 고르기부터 반영된다.

/** 문장으로 추가하기는 하루 10번까지(PLAN.md 5.3) */
export const TEXT_MAP_DAILY_LIMIT = 10;

export function userTopics(profile: Profile): UserTopic[] {
  return Object.entries(weightsOf(profile.id))
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ id, name: TOPIC_BY_ID.get(id)?.name ?? id }));
}

/** 아직 안 고른 토픽. 직업 추천 토픽을 앞에 둔다 */
export function suggestedTopics(profile: Profile): UserTopic[] {
  const mine = new Set(userTopics(profile).map((t) => t.id));
  const jobFirst = [...JOB_TOPICS[profile.job], ...TOPICS.map((t) => t.id)];
  return [...new Set(jobFirst)].filter((id) => !mine.has(id)).map((id) => ({ id, name: TOPIC_BY_ID.get(id)!.name }));
}

const names = (ids: string[]) => ids.map((id) => TOPIC_BY_ID.get(id)?.name ?? id).join(', ');
const obj = (ids: string[]) => josa(names(ids), '을', '를');
const topicOf = (ids: string[]) => josa(names(ids), '은', '는');

/** 고른 토픽은 가중치 1.0. 직업 추천(0.3)으로만 있던 토픽도 1.0으로 올린다 */
export function addTopics(profile: Profile, ids: string[]): TopicResult {
  const weights = weightsOf(profile.id);
  const limit = entitlements(profile).topicLimit;
  const valid = ids.filter((id) => TOPIC_BY_ID.has(id));
  const fresh = valid.filter((id) => !(weights[id]! > 0));
  const count = userTopics(profile).length;
  const room = Math.max(0, limit - count);
  const added = fresh.slice(0, room);
  for (const id of [...valid.filter((id) => weights[id]! > 0), ...added]) weights[id] = Math.max(weights[id] ?? 0, 1);

  if (fresh.length > added.length) {
    const head = added.length ? `${obj(added)} 추가했어요. ` : '';
    const who = profile.plan === 'free' ? '무료는' : '지금 플랜은';
    const after = count + added.length;
    const tail = after > limit ? `지금 ${after}개라 ${after - limit + 1}개를 빼야 더 추가할 수 있어요.` : '하나를 빼고 다시 추가해 주세요.';
    return { tone: 'warn', message: `${head}${who} 토픽 ${limit}개까지 고를 수 있어요. ${tail}` };
  }
  if (!added.length) return { tone: 'ok', message: `${topicOf(valid)} 이미 관심 토픽이에요.` };
  return { tone: 'ok', message: `${obj(added)} 추가했어요. 내일 아침 피드부터 반영돼요.` };
}

export function removeTopic(profile: Profile, id: string): TopicResult {
  const weights = weightsOf(profile.id);
  if (!(weights[id]! > 0)) return { tone: 'ok', message: '이미 뺀 토픽이에요.' };
  if (userTopics(profile).length <= 1) return { tone: 'warn', message: '토픽이 하나는 있어야 소식을 골라 드릴 수 있어요.' };
  delete weights[id];
  return { tone: 'ok', message: `${obj([id])} 뺐어요. 내일 아침 피드부터 이 토픽 소식은 덜 나와요.` };
}

/** 문장 → 토픽(AI). 사전에 없는 관심사는 버리지 않고 남겨 둔다 */
export async function addTopicsFromText(profile: Profile, raw: string): Promise<TopicResult> {
  const text = raw.trim().slice(0, 200);
  if (!text) return { tone: 'warn', message: '관심사를 한 단어 이상 적어 주세요.' };
  const usageKey = `${profile.id}|${kstDate()}`;
  const used = store.topicMapUsage.get(usageKey) ?? 0;
  if (used >= TEXT_MAP_DAILY_LIMIT) {
    return { tone: 'warn', message: `문장으로 추가하기는 하루 ${TEXT_MAP_DAILY_LIMIT}번까지예요. 아래 추천 토픽에서 골라 주세요.` };
  }
  store.topicMapUsage.set(usageKey, used + 1);

  const ids = await ai.mapTopics({ model: modelForPlan(profile.plan), text, dictionary: TOPICS });
  if (!ids.length) {
    store.unmatched.push({ userId: profile.id, text, at: Date.now() });
    return { tone: 'warn', message: `"${text}"에 맞는 토픽은 아직 없어요. 토픽을 늘릴 때 참고할게요. 아래 추천 토픽에서도 골라 보세요.` };
  }
  return addTopics(profile, ids);
}
