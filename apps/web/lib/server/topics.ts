import 'server-only';
import {
  childrenOf, customTopicId, findTopicByName, isAdultInterest, isCustomTopicId, isNewsSection, NEWS_SECTIONS, splitInterests, TOPIC_BY_ID, TOPIC_GROUPS, TOPICS,
} from '@maengo/core/topics';
import { screener, screenModel } from './ai';
import { db, must } from './db';
import type { TopicGroupView, TopicResult, TopicSuggestion, UserTopic } from '../types';
import { entitlements, type Profile } from './profile';

// 관심사 고치기(설정). user_topics에 바로 쓰고, 다음 피드 고르기부터 반영된다.
// 목록(사전)에서 고른 관심사와, 목록에 없어 기타에 적은 그대로 올린 관심사(custom 토픽)가 있다. 개수는 따로 센다.

async function weightsOf(userId: string): Promise<Record<string, number>> {
  const rows = must(await db.from('user_topics').select('topic_id,weight').eq('user_id', userId), 'user_topics') as { topic_id: string; weight: number }[];
  return Object.fromEntries(rows.map((r) => [r.topic_id, r.weight]));
}

/** 토픽 이름. 사전에 없는 것(기타에 적은 관심사)은 DB에서 찾는다 */
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
  return entries.map(([id]) => ({ id, name: names.get(id) ?? id, custom: isCustomTopicId(id) }));
}

/** 관심 분야 5개와 그 아래 상세 관심사. 고른 것은 표시만 하고 더하기 버튼을 숨긴다 */
export function topicGroups(mine: UserTopic[]): TopicGroupView[] {
  const picked = new Set(mine.map((t) => t.id));
  return TOPIC_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    picked: picked.has(g.id),
    details: childrenOf(g.id).map((c) => ({ id: c.id, name: c.name, picked: picked.has(c.id) })),
  }));
}

/** 뉴스 분야 6개(상세 관심사 없음) */
export function newsSections(mine: UserTopic[]): { id: string; name: string; picked: boolean }[] {
  const picked = new Set(mine.map((t) => t.id));
  return NEWS_SECTIONS.map((n) => ({ id: n.id, name: n.name, picked: picked.has(n.id) }));
}

/**
 * 관심사 더하기. 가중치 1.0으로 넣고, 피드백으로 낮아진 것도 다시 고르면 1.0으로 올린다.
 * ids는 사전 id거나 이미 topics에 넣어 둔 기타 id다. 관심사 한도는 사전 id만 센다(기타 한도는 addCustomTopics에서 본다).
 * 잘 들어갔으면 문구 없이(목록에 보인다), 한도로 일부만 들어갔을 때만 알린다. note는 기타 한도 안내.
 */
async function addTopicIds(profile: Profile, ids: string[], source: 'settings' | 'text', note = ''): Promise<TopicResult> {
  const weights = await weightsOf(profile.id);
  const limit = entitlements(profile).topicLimit;
  const fresh = ids.filter((id) => !(weights[id]! > 0));
  const freshTopics = fresh.filter((id) => !isCustomTopicId(id));
  const count = Object.keys(weights).filter((id) => weights[id]! > 0 && !isCustomTopicId(id)).length;
  const room = Math.max(0, limit - count);
  const addedTopics = freshTopics.slice(0, room);
  const added = [...addedTopics, ...fresh.filter(isCustomTopicId)];
  const raise = [...ids.filter((id) => weights[id]! > 0 && weights[id]! < 1), ...added];
  if (raise.length) {
    must(
      await db.from('user_topics').upsert(raise.map((topic_id) => ({ user_id: profile.id, topic_id, weight: 1, source })), { onConflict: 'user_id,topic_id' }),
      'user_topics upsert',
    );
  }
  if (freshTopics.length > addedTopics.length) {
    const who = profile.plan === 'free' ? 'Free는' : '지금 플랜은';
    const after = count + addedTopics.length;
    const tail = after > limit ? `지금 ${after}개라 ${after - limit + 1}개를 빼야 더 추가할 수 있어요.` : '하나를 빼고 다시 추가해 주세요.';
    return { tone: 'warn', message: `${who} 관심사를 ${limit}개까지 고를 수 있어요. ${tail}` };
  }
  return { tone: 'ok', message: note };
}

/**
 * 설정의 더하기·켜기 버튼(분야 전체, 상세 관심사, 뉴스 분야). 사전에 있는 id만 받는다.
 * 분야 전체와 상세 관심사는 따로 켜고 끈다. 둘 다 켜면 상세 관심사 소식을 더 자주 고른다(랭킹에서 관련도가 더해진다).
 */
export async function addTopics(profile: Profile, ids: string[]): Promise<TopicResult> {
  const valid = ids.filter((id) => TOPIC_BY_ID.has(id));
  if (!valid.length) return { tone: 'warn', message: '없는 관심사예요.' };
  return addTopicIds(profile, valid, 'settings');
}

const LAST: TopicResult = { tone: 'warn', message: '관심사가 하나는 있어야 소식을 골라 드릴 수 있어요.' };

export async function removeTopic(profile: Profile, id: string): Promise<TopicResult> {
  const mine = await userTopics(profile);
  const hit = mine.find((t) => t.id === id);
  if (!hit) return { tone: 'ok', message: '' };
  // 기타까지 합쳐 하나는 남겨야 소식을 고를 수 있다(온보딩에서 기타만 고르면 기타만 있다)
  if (mine.length <= 1) return LAST;
  must(await db.from('user_topics').delete().eq('user_id', profile.id).eq('topic_id', id), 'user_topics delete');
  return { tone: 'ok', message: '' };
}

/** 설정 카드의 ×: 분야 하나(분야 전체 + 그 상세 관심사), 뉴스 헤드라인 전부, 기타 전부를 한 번에 뺀다 */
export async function removeCard(profile: Profile, card: string): Promise<TopicResult> {
  const mine = await userTopics(profile);
  const inCard = (t: UserTopic) =>
    card === 'etc' ? !!t.custom : card === 'news' ? isNewsSection(t.id) : t.id === card || TOPIC_BY_ID.get(t.id)?.parent === card;
  const ids = mine.filter(inCard).map((t) => t.id);
  if (!ids.length) return { tone: 'ok', message: '' };
  if (ids.length >= mine.length) return LAST;
  must(await db.from('user_topics').delete().eq('user_id', profile.id).in('topic_id', ids), 'user_topics card delete');
  return { tone: 'ok', message: '' };
}

/** 설정 > 관심사 찾기 칸의 자동 완성 후보: 사전 전체(이름·별칭으로 찾는다). hint는 어느 분야인지 */
export function topicSuggestions(): TopicSuggestion[] {
  return TOPICS.map((t) => ({
    id: t.id,
    name: t.name,
    hint: t.parent ? TOPIC_BY_ID.get(t.parent)!.name : isNewsSection(t.id) ? '뉴스 헤드라인' : '분야 전체',
    terms: [t.name, ...t.aliases],
  }));
}

const ADULT: TopicResult = { tone: 'warn', code: 'adult', message: '성인 관련 관심사는 넣을 수 없어요.' };

/**
 * 금칙어 목록을 통과한 새 기타 관심사를 Gemini에 한 번 더 묻는다(은어·우회 표기).
 * 누가 이미 넣어 둔 말은 검사를 통과한 것이라 다시 묻지 않는다. Gemini가 안 되면(한도·시간 초과) 통과시킨다.
 */
async function looksAdult(custom: { id: string; name: string }[]): Promise<boolean> {
  if (!custom.length) return false;
  const known = must(await db.from('topics').select('id').in('id', custom.map((c) => c.id)), 'topics known') as { id: string }[];
  const fresh = custom.filter((c) => !known.some((k) => k.id === c.id));
  if (!fresh.length) return false;
  try {
    return (await screener.screenInterest({ model: screenModel(), phrases: fresh.map((c) => c.name) })).adult;
  } catch (e) {
    console.warn('[screen] 관심사 검사 실패, 통과시킴:', (e as Error).message);
    return false;
  }
}

/**
 * 기타에 적기(온보딩·설정). 쉼표 등으로 나눈 말(최대 3개)을 적은 그대로 올린다.
 * 목록에 같은 이름·별칭이 있으면 그 관심사로 넣고('종부세' → 부동산 정책·세금, 기타 개수에 안 셈),
 * 없으면 custom 토픽을 만든다(Free 1개, Premium 10개). 성인 키워드는 받지 않는다.
 */
export async function addCustomTopics(profile: Profile, raw: string): Promise<TopicResult> {
  const text = raw.trim().slice(0, 200);
  if (!text) return { tone: 'warn', message: '기타에 한 단어 이상 적어 주세요.' };
  if (isAdultInterest(text)) return ADULT;
  const phrases = splitInterests(text);
  if (!phrases.length) return { tone: 'warn', message: '기타에 한 단어 이상 적어 주세요.' };
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
  // 기타 개수 한도(Free 1개, Premium 10개). 이미 넣은 말은 다시 세지 않는다
  const limit = entitlements(profile).customLimit;
  const weights = await weightsOf(profile.id);
  const mineCustom = Object.keys(weights).filter((id) => isCustomTopicId(id) && weights[id]! > 0);
  const freshCustom = custom.filter((c) => !mineCustom.includes(c.id));
  const room = Math.max(0, limit - mineCustom.length);
  let limitNote = '';
  if (freshCustom.length > room) {
    const drop = new Set(freshCustom.slice(room).map((c) => c.id));
    for (const id of drop) ids.splice(ids.indexOf(id), 1);
    custom.splice(0, custom.length, ...custom.filter((c) => !drop.has(c.id)));
    const plan = profile.plan === 'free' ? 'Free는' : 'Premium은';
    const msg = `${plan} 기타에 ${limit}개까지 적을 수 있어요.${profile.plan === 'free' ? ' Premium은 10개까지예요.' : ''} 하나를 빼고 다시 적어 주세요.`;
    if (!ids.length) return { tone: 'warn', message: msg };
    limitNote = msg;
  }
  if (await looksAdult(custom)) return ADULT;
  if (custom.length) {
    // 같은 말을 누가 먼저 넣었으면 그 이름을 그대로 둔다
    must(
      await db.from('topics').upsert(custom.map((c) => ({ id: c.id, name: c.name, aliases: [], popularity: 1000, custom: true })), { onConflict: 'id', ignoreDuplicates: true }),
      'topics custom',
    );
  }
  return addTopicIds(profile, [...new Set(ids)], 'text', limitNote);
}
