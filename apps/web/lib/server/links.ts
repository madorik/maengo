import 'server-only';
import { blockedHost, isAdultInterest, isLinkTopicId, isPrivateHost, LINK_ERROR_MESSAGE, linkSourceId, linkTopicId, normalizeLinkInput, type LinkError } from '@maengo/core/topics';
import type { LinkView, TopicResult } from '../types';
import { db, must } from './db';
import { entitlements, type Profile } from './profile';
import { userTopics } from './topics';

// 내 관심 링크(설정, Premium, 2026-10-15): 블로그·사이트 주소를 넣으면 그곳의 RSS를 찾아 출처(sources, custom)로 두고
// user_topics에 토픽 's-<sources.id>'로 구독한다. 그 뒤로는 관심사와 같이 랭킹·피드백·지급을 탄다(pipeline tagLinks가 묶음에 붙인다).
// 설정에서는 칸(인풋박스) 3개로 관리한다(user_topics.slot, 1부터). 넣어 둔 칸에 다른 주소를 넣으면 그 칸의 링크가 바뀐다.
// 같은 피드는 사용자끼리 한 행. 구독자가 없어지면 출처를 끈다(active = false). 유튜브는 받지 않는다. 주소 규칙은 core topics/links.ts.

const warn = (message: string, code?: LinkError): TopicResult => ({ tone: 'warn', message, ...(code ? { code } : {}) });
const ADULT: TopicResult = { tone: 'warn', code: 'adult', message: '성인 관련 사이트는 넣을 수 없어요.' };
const LAST: TopicResult = { tone: 'warn', message: '관심사가 하나는 있어야 소식을 골라 드릴 수 있어요.' };
/** 이만큼 잇달아 실패하면 목록에 '가져오지 못함'을 보인다(3시간마다 받으니 하루 남짓) */
const FAILING_AFTER = 5;

interface SourceRow {
  id: number;
  name: string;
  url: string;
  lang: 'ko' | 'en';
  active: boolean;
  custom: boolean;
}

/** 내 링크 토픽과 칸 번호. 칸이 없는 옛 행은 비어 있는 칸부터 차례로 둔다 */
async function myLinks(userId: string): Promise<{ topicId: string; slot: number }[]> {
  const rows = must(await db.from('user_topics').select('topic_id,slot').eq('user_id', userId).like('topic_id', 's-%'), 'user_topics links') as { topic_id: string; slot: number | null }[];
  const taken = new Set(rows.map((r) => r.slot).filter((x): x is number => x != null));
  let next = 1;
  return rows
    .filter((r) => isLinkTopicId(r.topic_id))
    .map((r) => {
      if (r.slot != null) return { topicId: r.topic_id, slot: r.slot };
      while (taken.has(next)) next++;
      taken.add(next);
      return { topicId: r.topic_id, slot: next };
    })
    .sort((a, b) => a.slot - b.slot);
}

/** '오늘'·'3일 전'·'2주 전'·'5달 전'. 날짜 단위라 시간대 차이는 하루 안에서만 어긋난다 */
export function agoLabel(iso: string, now = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000));
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}달 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** 설정 칸: 내가 넣은 링크(칸 번호·이름·사이트·마지막 글 시점·실패 여부). 칸 순 */
export async function userLinks(profile: Profile): Promise<LinkView[]> {
  const mine = await myLinks(profile.id);
  const ids = mine.map((m) => linkSourceId(m.topicId)).filter((id): id is number => id != null);
  if (!ids.length) return [];
  const rows = must(await db.from('sources').select('id,name,url,site_url,last_item_at,fail_count').in('id', ids), 'sources links') as {
    id: number;
    name: string;
    url: string;
    site_url: string | null;
    last_item_at: string | null;
    fail_count: number;
  }[];
  const now = new Date();
  const slotOf = new Map(mine.map((m) => [m.topicId, m.slot]));
  return rows
    .map((r) => ({
      id: linkTopicId(r.id),
      slot: slotOf.get(linkTopicId(r.id)) ?? 0,
      name: r.name,
      siteUrl: r.site_url ?? r.url,
      lastItemLabel: r.last_item_at ? agoLabel(r.last_item_at, now) : null,
      failing: r.fail_count >= FAILING_AFTER,
    }))
    .sort((a, b) => a.slot - b.slot);
}

/**
 * 칸(slot)에 링크 넣기. 주소만 보고 막을 것(유튜브·SNS·사설 주소)은 바로 돌려보내고, 그다음 RSS를 찾아 확인한다(pipeline resolveLink).
 * 찾으면 sources(같은 피드는 한 행)·topics('s-<id>')·user_topics에 넣고, 창 안의 최근 글을 그 자리에서 처리해 바로 후보가 되게 한다.
 * 그 칸에 이미 다른 링크가 있으면 뺀 뒤 넣는다(같은 피드면 그대로). 성공은 문구 없이(칸에 보인다), 막히면 까닭만
 */
export async function addLink(profile: Profile, raw: string, slot: number): Promise<TopicResult> {
  const limit = entitlements(profile).linkLimit;
  if (limit <= 0) return warn('내 관심 링크는 Premium에서 넣을 수 있어요.');
  if (!Number.isInteger(slot) || slot < 1 || slot > limit) return warn('없는 칸이에요.');
  const text = raw.trim().slice(0, 500);
  const u = normalizeLinkInput(text);
  if (!u) return warn(LINK_ERROR_MESSAGE.invalid, 'invalid');
  const blocked = blockedHost(u.hostname);
  if (blocked) return warn(LINK_ERROR_MESSAGE[blocked], blocked);
  if (isPrivateHost(u.hostname)) return warn(LINK_ERROR_MESSAGE.private, 'private');
  if (isAdultInterest(u.hostname)) return ADULT;
  const mine = await myLinks(profile.id);
  const inSlot = mine.find((m) => m.slot === slot);
  if (!inSlot && mine.length >= limit) return warn(`내 관심 링크는 ${limit}개까지 넣을 수 있어요. 하나를 빼고 다시 넣어 주세요.`);

  // 파이프라인은 무거워서 여기서만 불러온다(feed.ts의 '하나 더 받기'와 같은 방식)
  const { resolveLink, ingestLinkNow } = await import('@maengo/pipeline/links');
  const r = await resolveLink(text);
  if (!r.ok) return warn(LINK_ERROR_MESSAGE[r.error], r.error);
  const { link } = r;
  if (isAdultInterest(link.name)) return ADULT;
  const latest = Math.max(...link.entries.map((e) => e.publishedAt?.getTime() ?? 0));
  const lastItemAt = latest > 0 ? new Date(latest).toISOString() : null;

  // 같은 피드는 한 행. 꺼 둔 행(구독자가 없었거나 공개 출처에서 뺀 것)이면 사용자 출처로 다시 켠다
  let source = must(await db.from('sources').select('id,name,url,lang,active,custom').eq('url', link.feedUrl).maybeSingle(), 'sources find') as SourceRow | null;
  if (source && !source.active) {
    must(await db.from('sources').update({ active: true, custom: true, site_url: link.siteUrl, fail_count: 0, last_error: null, ...(lastItemAt ? { last_item_at: lastItemAt } : {}) }).eq('id', source.id), 'sources reactivate');
    source = { ...source, active: true, custom: true };
  }
  if (!source) {
    const { data, error } = await db
      .from('sources')
      .insert({ kind: 'rss', url: link.feedUrl, name: link.name, weight: 1, lang: link.lang, active: true, custom: true, site_url: link.siteUrl, last_item_at: lastItemAt })
      .select('id,name,url,lang,active,custom')
      .single();
    if (error) {
      // 두 사람이 같은 피드를 동시에 넣었다(unique): 먼저 들어간 행을 쓴다
      if (error.code !== '23505') throw new Error(`sources insert: ${error.message}`);
      source = must(await db.from('sources').select('id,name,url,lang,active,custom').eq('url', link.feedUrl).single(), 'sources find again') as SourceRow;
    } else source = data as SourceRow;
  }

  const topicId = linkTopicId(source.id);
  const already = mine.find((m) => m.topicId === topicId);
  if (already) {
    // 같은 피드를 다른 칸에 넣었다: 그 칸으로 옮긴다(한 피드는 한 칸)
    if (already.slot !== slot) {
      if (inSlot) await dropLink(profile.id, inSlot.topicId);
      must(await db.from('user_topics').update({ slot }).eq('user_id', profile.id).eq('topic_id', topicId), 'user_topics link slot');
    }
    return { tone: 'ok', message: '' };
  }
  // 그 칸의 다른 링크는 뺀다
  if (inSlot) await dropLink(profile.id, inSlot.topicId);
  // 토픽 행(feeds·cluster_topics가 가리킨다). 먼저 넣은 이름을 둔다
  must(await db.from('topics').upsert({ id: topicId, name: source.name, aliases: [], popularity: 1000, custom: false }, { onConflict: 'id', ignoreDuplicates: true }), 'topics link');
  must(
    await db.from('user_topics').upsert({ user_id: profile.id, topic_id: topicId, weight: 1, source: 'settings', slot }, { onConflict: 'user_id,topic_id' }),
    'user_topics link',
  );
  // 넣자마자 후보가 되게 창 안의 글을 지금 처리한다. 실패해도 넣기는 끝났고 3시간마다 도는 수집이 잇는다
  try {
    await ingestLinkNow({ id: source.id, url: source.url, name: source.name, lang: source.lang, custom: source.custom }, link.entries);
  } catch (e) {
    console.warn('[link] 바로 처리 실패:', (e as Error).message);
  }
  return { tone: 'ok', message: '' };
}

/** 구독 한 줄을 지우고, 아무도 구독하지 않게 된 사용자 출처는 끈다 */
async function dropLink(userId: string, topicId: string): Promise<void> {
  must(await db.from('user_topics').delete().eq('user_id', userId).eq('topic_id', topicId), 'user_topics link delete');
  await releaseLinks([topicId]);
}

/** 링크 빼기(칸 비우기). 구독은 지우고, 아무도 구독하지 않는 사용자 출처는 끈다(글·묶음은 남는다) */
export async function removeLink(profile: Profile, topicId: string): Promise<TopicResult> {
  if (!isLinkTopicId(topicId)) return warn('없는 링크예요.');
  const mine = await userTopics(profile);
  if (!mine.some((t) => t.id === topicId)) return { tone: 'ok', message: '' };
  // 기타·링크까지 합쳐 하나는 남겨야 소식을 고를 수 있다
  if (mine.length <= 1) return LAST;
  await dropLink(profile.id, topicId);
  return { tone: 'ok', message: '' };
}

/** 구독자가 없어진 사용자 출처를 끈다(링크 빼기·계정 삭제 뒤). 공개 출처(custom = false)는 건드리지 않는다 */
export async function releaseLinks(topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    const sourceId = linkSourceId(topicId);
    if (sourceId == null) continue;
    const { count } = await db.from('user_topics').select('user_id', { count: 'exact', head: true }).eq('topic_id', topicId);
    if (!count) await db.from('sources').update({ active: false }).eq('id', sourceId).eq('custom', true);
  }
}
