import 'server-only';
import { josa } from '@maengo/core/josa';
import { kstDate } from '@maengo/core/kst';
import {
  childrenOf, customTopicId, findTopicByName, isAdultInterest, splitInterests, TOPIC_BY_ID, TOPIC_GROUPS,
} from '@maengo/core/topics';
import { db, must } from './db';
import type { TopicGroupView, TopicResult, UserTopic } from '../types';
import { entitlements, type Profile } from './profile';

// 관심사 고치기(설정). user_topics에 바로 쓰고, 다음 피드 고르기부터 반영된다.
// 직접 입력한 관심사는 적은 그대로 올린다. 사전에 같은 이름이 있으면 그 관심사로, 없으면 새 관심사(custom)로.

/** 직접 입력해 더하기는 하루 10번까지 */
export const TEXT_ADD_DAILY_LIMIT = 10;

async function weightsOf(userId: string): Promise<Record<string, number>> {
  const rows = must(await db.from('user_topics').select('topic_id,weight').eq('user_id', userId), 'user_topics') as { topic_id: string; weight: number }[];
  return Object.fromEntries(rows.map((r) => [r.topic_id, r.weight]));
}

/** 토픽 이름. 사전에 없는 것(직접 입력한 관심사)은 DB에서 찾는다 */
export async function topicNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unknown: string[] = [];
  for (const id of new Set(ids)) {
    const t = TOPIC_BY_ID.get(id);
    if (t) out.set(id, t.name);
    else unknown.push(id);
  }
  if (unknown.length) {
    const rows = must(await db.from('topics').select('id,name').in('id', unknown), 'topics') as { id: string; name: string }[];
    for (const r of rows) out.set(r.id, r.name);
  }
  return out;
}

export async function userTopics(profile: Profile): Promise<UserTopic[]> {
  const entries = Object.entries(await weightsOf(profile.id)).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  const names = await topicNames(entries.map(([id]) => id));
  return entries.map(([id]) => ({ id, name: names.get(id) ?? id }));
}

/** 큰 분류 5개와 그 아래 상세 관심사. 고른 것은 표시만 하고 더하기 버튼을 숨긴다 */
export function topicGroups(mine: UserTopic[]): TopicGroupView[] {
  const picked = new Set(mine.map((t) => t.id));
  return TOPIC_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    picked: picked.has(g.id),
    details: childrenOf(g.id).map((c) => ({ id: c.id, name: c.name, picked: picked.has(c.id) })),
  }));
}

const list = (names: string[]) => names.join(', ');
const obj = (names: string[]) => josa(list(names), '을', '를');
const topicOf = (names: string[]) => josa(list(names), '은', '는');

/**
 * 관심사 더하기. 가중치 1.0으로 넣고, 피드백으로 낮아진 것도 다시 고르면 1.0으로 올린다.
 * ids는 사전 id거나 이미 topics에 넣어 둔 직접 입력 관심사 id다.
 */
async function addTopicIds(profile: Profile, ids: string[], source: 'settings' | 'text', extra = ''): Promise<TopicResult> {
  const weights = await weightsOf(profile.id);
  const limit = entitlements(profile).topicLimit;
  const fresh = ids.filter((id) => !(weights[id]! > 0));
  const count = Object.values(weights).filter((w) => w > 0).length;
  const added = fresh.slice(0, Math.max(0, limit - count));
  const raise = [...ids.filter((id) => weights[id]! > 0 && weights[id]! < 1), ...added];
  if (raise.length) {
    must(
      await db.from('user_topics').upsert(raise.map((topic_id) => ({ user_id: profile.id, topic_id, weight: 1, source })), { onConflict: 'user_id,topic_id' }),
      'user_topics upsert',
    );
  }
  const names = await topicNames(ids);
  const n = (xs: string[]) => xs.map((id) => names.get(id) ?? id);

  if (fresh.length > added.length) {
    const head = added.length ? `${obj(n(added))} 추가했어요. ` : '';
    const who = profile.plan === 'free' ? 'Free는' : '지금 플랜은';
    const after = count + added.length;
    const tail = after > limit ? `지금 ${after}개라 ${after - limit + 1}개를 빼야 더 추가할 수 있어요.` : '하나를 빼고 다시 추가해 주세요.';
    return { tone: 'warn', message: `${head}${who} 관심사를 ${limit}개까지 고를 수 있어요. ${tail}` };
  }
  if (!added.length) return { tone: 'ok', message: `${topicOf(n(ids))} 이미 고른 관심사예요.` };
  return { tone: 'ok', message: `${obj(n(added))} 추가했어요. 내일 아침 피드부터 반영돼요.${extra}` };
}

/** 설정의 분류별 더하기 버튼. 사전에 있는 id만 받는다 */
export async function addTopics(profile: Profile, ids: string[]): Promise<TopicResult> {
  const valid = ids.filter((id) => TOPIC_BY_ID.has(id));
  if (!valid.length) return { tone: 'warn', message: '없는 관심사예요.' };
  return addTopicIds(profile, valid, 'settings');
}

export async function removeTopic(profile: Profile, id: string): Promise<TopicResult> {
  const mine = await userTopics(profile);
  const hit = mine.find((t) => t.id === id);
  if (!hit) return { tone: 'ok', message: '이미 뺀 관심사예요.' };
  if (mine.length <= 1) return { tone: 'warn', message: '관심사가 하나는 있어야 소식을 골라 드릴 수 있어요.' };
  must(await db.from('user_topics').delete().eq('user_id', profile.id).eq('topic_id', id), 'user_topics delete');
  return { tone: 'ok', message: `${obj([hit.name])} 뺐어요. 내일 아침 피드부터 이 분야 소식은 덜 나와요.` };
}

// 하루 횟수는 서버 메모리로 센다(개발 중)
const g = globalThis as typeof globalThis & { __maengoTopicMap?: Map<string, number> };
const textAddUsage = (g.__maengoTopicMap ??= new Map());

/**
 * 직접 입력해 더하기. 쉼표 등으로 나눈 말(최대 3개)을 그대로 내 관심사에 올린다.
 * 사전에 같은 이름·별칭이 있으면 그 관심사로('청약' → 청약·분양), 없으면 새 관심사를 만든다. 성인 키워드는 받지 않는다.
 */
export async function addTopicsFromText(profile: Profile, raw: string): Promise<TopicResult> {
  const text = raw.trim().slice(0, 200);
  if (!text) return { tone: 'warn', message: '관심사를 한 단어 이상 적어 주세요.' };
  if (isAdultInterest(text)) return { tone: 'warn', message: '성인 관련 관심사는 등록할 수 없어요.' };
  const usageKey = `${profile.id}|${kstDate()}`;
  const used = textAddUsage.get(usageKey) ?? 0;
  if (used >= TEXT_ADD_DAILY_LIMIT) {
    return { tone: 'warn', message: `직접 입력해 더하기는 하루 ${TEXT_ADD_DAILY_LIMIT}번까지예요. 아래 목록에서 골라 주세요.` };
  }
  textAddUsage.set(usageKey, used + 1);

  const phrases = splitInterests(text);
  if (!phrases.length) return { tone: 'warn', message: '관심사를 한 단어 이상 적어 주세요.' };
  const ids: string[] = [];
  const custom: { id: string; name: string }[] = [];
  for (const p of phrases) {
    const known = findTopicByName(p);
    if (known) ids.push(known.id);
    else {
      const id = customTopicId(p);
      custom.push({ id, name: p });
      ids.push(id);
    }
  }
  if (custom.length) {
    // 같은 말을 누가 먼저 넣었으면 그 이름을 그대로 둔다
    must(
      await db.from('topics').upsert(custom.map((c) => ({ id: c.id, name: c.name, aliases: [], popularity: 1000, custom: true })), { onConflict: 'id', ignoreDuplicates: true }),
      'topics custom',
    );
  }
  const note = custom.length ? ' 직접 넣은 관심사는 관련 소식이 모이는 대로 골라 드려요.' : '';
  return addTopicIds(profile, [...new Set(ids)], 'text', note);
}
