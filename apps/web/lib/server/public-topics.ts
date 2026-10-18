import 'server-only';
import { cache } from 'react';
import { popularityBoost, rankFeed, type RankCandidate } from '@maengo/core/feed';
import { childrenOf } from '@maengo/core/topics';
import { PUBLIC_TOPICS, type PublicTopic } from '../public-topics';
import { db, must } from './db';

// 공개 분야 페이지(/topics/…)의 소식. 로그인한 사람의 피드와 같은 요약(basic)과 랭킹(rankFeed)을 쓰되 사람마다 다른 것(why·읽음)은 빼고,
// 제목·한 줄 요약·원문 링크만 보인다. 다시 쓴 전체 글은 공개하지 않는다.
// 사용자가 넣은 출처(내 관심 링크, sources.custom)의 글은 대표 글로도, 출처 목록에도 쓰지 않는다.

const DAY = 24 * 3600_000;
/** 목록에 보이는 기간과 개수 */
const LIST_DAYS = 7;
const LIST_LIMIT = 12;
/** 출처 목록을 셀 기간과 개수 */
const SOURCE_DAYS = 30;
const SOURCE_LIMIT = 16;

export interface PublicTopicItem {
  clusterId: number;
  title: string;
  short: string;
  url: string;
  kind: 'article' | 'video';
  sourceLabel: string;
  coverage?: string;
  /** 발행일(없으면 처음 본 날), ISO */
  date: string;
}

export interface PublicTopicDigest {
  items: PublicTopicItem[];
  /** 지난 30일 이 분야 소식을 낸 출처(많이 낸 순) */
  sources: string[];
  /** 이 분야에 마지막으로 요약된 소식의 시각. 없으면 null */
  updatedAt: string | null;
}

interface SummaryRow {
  cluster_id: number;
  title: string;
  short: string;
  published_at: string | null;
  created_at: string;
  clusters: {
    first_seen_at: string;
    size: number;
    is_video: boolean;
    rep_item_id: number | null;
    rep: { views: number | null; hn_points: number | null; published_at: string | null; sources: { weight: number } | null } | null;
  };
}

interface ItemRow {
  id: number;
  cluster_id: number;
  canonical_url: string;
  kind: 'article' | 'video';
  sources: { name: string; custom: boolean } | null;
}

/** id를 size개씩 나눠 읽는다(주소 길이와 한 번에 돌려주는 행 수 1000개 한도) */
async function inChunks<T>(ids: number[], size: number, read: (chunk: number[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await read(ids.slice(i, i + size))));
  return out;
}

/** 지난 30일 요약된 소식과, 그 소식에 붙은 공개 분야 토픽. 한 번 그릴 때 한 번만 읽는다 */
const recent = cache(async () => {
  const since = new Date(Date.now() - SOURCE_DAYS * DAY).toISOString();
  const summaries = must(
    await db
      .from('summaries')
      .select('cluster_id,title,short,published_at,created_at,clusters!inner(first_seen_at,size,is_video,skip_reason,rep_item_id,rep:items!clusters_rep_item_id_fkey(views,hn_points,published_at,sources(weight)))')
      .eq('tier', 'basic')
      .gte('clusters.first_seen_at', since)
      .is('clusters.skip_reason', null)
      .order('created_at', { ascending: false }),
    'public summaries',
  ) as unknown as SummaryRow[];

  const topicIds = PUBLIC_TOPICS.flatMap((t) => [t.id, ...childrenOf(t.id).map((c) => c.id)]);
  const tags = await inChunks(
    summaries.map((s) => s.cluster_id),
    200,
    async (ids) =>
      must(await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', ids).in('topic_id', topicIds), 'public cluster_topics') as {
        cluster_id: number;
        topic_id: string;
        relevance: number;
      }[],
  );
  const topicsOf = new Map<number, { topicId: string; relevance: number }[]>();
  for (const t of tags) (topicsOf.get(t.cluster_id) ?? topicsOf.set(t.cluster_id, []).get(t.cluster_id)!).push({ topicId: t.topic_id, relevance: t.relevance });
  return { summaries, topicsOf };
});

const dateOf = (s: SummaryRow) => s.published_at ?? s.clusters.first_seen_at;

/** 한 분야의 공개 소식(지난 7일, 최대 12개)과 출처 목록 */
export async function publicTopicDigest(topic: PublicTopic): Promise<PublicTopicDigest> {
  const { summaries, topicsOf } = await recent();
  const ids = new Set([topic.id, ...childrenOf(topic.id).map((c) => c.id)]);
  const mine = summaries.filter((s) => topicsOf.get(s.cluster_id)?.some((t) => ids.has(t.topicId)));
  if (!mine.length) return { items: [], sources: [], updatedAt: null };

  const items = await inChunks(
    mine.map((s) => s.cluster_id),
    50,
    async (chunk) => must(await db.from('items').select('id,cluster_id,canonical_url,kind,sources(name,custom)').in('cluster_id', chunk), 'public items') as unknown as ItemRow[],
  );
  const publicMembers = new Map<number, ItemRow[]>();
  for (const it of items) {
    if (!it.sources || it.sources.custom) continue;
    (publicMembers.get(it.cluster_id) ?? publicMembers.set(it.cluster_id, []).get(it.cluster_id)!).push(it);
  }

  // 대표 글: 묶음의 대표 글이 공개 출처면 그 글, 아니면 공개 출처 글 중 첫 글. 원문 링크와 출처 목록이 이 글을 쓴다
  const repOf = new Map<number, ItemRow>();
  for (const s of mine) {
    const members = publicMembers.get(s.cluster_id);
    if (members) repOf.set(s.cluster_id, members.find((m) => m.id === s.clusters.rep_item_id) ?? members[0]!);
  }

  // 출처 목록: 지난 30일 이 분야 소식의 대표 글을 낸 출처(같은 소식을 함께 다룬 곳까지 세면 헤드라인 언론사가 모든 분야에 끼어서)
  const perSource = new Map<string, number>();
  for (const rep of repOf.values()) perSource.set(rep.sources!.name, (perSource.get(rep.sources!.name) ?? 0) + 1);
  const sources = [...perSource]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .slice(0, SOURCE_LIMIT)
    .map(([name]) => name);

  // 목록: 지난 7일 소식을 이 분야 전체를 고른 사람의 순서로
  const now = new Date();
  const weekAgo = now.getTime() - LIST_DAYS * DAY;
  const weights = Object.fromEntries([...ids].map((id) => [id, 1]));
  const candidates: RankCandidate[] = mine
    .filter((s) => Date.parse(s.clusters.first_seen_at) >= weekAgo && publicMembers.has(s.cluster_id))
    .map((s) => {
      const rep = s.clusters.rep;
      return {
        id: s.cluster_id,
        ageHours: (now.getTime() - Date.parse(s.clusters.first_seen_at)) / 3600_000,
        sourceWeight: rep?.sources?.weight ?? 1,
        popularity: rep ? popularityBoost({ sourceWeight: 1, views: rep.views, hnPoints: rep.hn_points, publishedAt: rep.published_at }, now) : 1,
        size: s.clusters.size,
        isVideo: s.clusters.is_video,
        topics: topicsOf.get(s.cluster_id)!.filter((t) => ids.has(t.topicId)),
      };
    });
  const byId = new Map(mine.map((s) => [s.cluster_id, s]));
  const ranked = rankFeed(candidates, weights, new Set(), { limit: LIST_LIMIT, maxPerTopic: 3, maxVideos: 3 });

  return {
    items: ranked.map(({ clusterId }) => {
      const s = byId.get(clusterId)!;
      const members = publicMembers.get(clusterId)!;
      const rep = repOf.get(clusterId)!;
      const others = [...new Set(members.filter((m) => m !== rep).map((m) => m.sources!.name).filter((n) => n !== rep.sources!.name))];
      return {
        clusterId,
        title: s.title,
        short: s.short,
        url: rep.canonical_url,
        kind: rep.kind,
        sourceLabel: rep.sources!.name,
        coverage: others.length === 0 ? undefined : others.length === 1 ? `${others[0]}에서도 다뤘어요` : `${others[0]} 외 ${others.length - 1}곳에서도 다뤘어요`,
        date: dateOf(s),
      };
    }),
    sources,
    updatedAt: mine.reduce((a, s) => (s.created_at > a ? s.created_at : a), mine[0]!.created_at),
  };
}

/** 분야별 마지막 요약 시각(사이트맵 lastmod). 소식이 없으면 그 분야는 빠진다 */
export async function publicTopicsUpdatedAt(): Promise<Map<string, string>> {
  const { summaries, topicsOf } = await recent();
  const out = new Map<string, string>();
  for (const t of PUBLIC_TOPICS) {
    const ids = new Set([t.id, ...childrenOf(t.id).map((c) => c.id)]);
    for (const s of summaries) {
      if (!topicsOf.get(s.cluster_id)?.some((x) => ids.has(x.topicId))) continue;
      if (s.created_at > (out.get(t.slug) ?? '')) out.set(t.slug, s.created_at);
    }
  }
  return out;
}
