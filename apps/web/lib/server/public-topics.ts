import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { MIN_RELEVANCE, popularityBoost, rankFeed, type Impact, type RankCandidate } from '@maengo/core/feed';
import { childrenOf } from '@maengo/core/topics';
import { PUBLIC_DETAILS, PUBLIC_TOPICS, type PublicDetail, type PublicTopic } from '../public-topics';
import { db, must } from './db';
import { sharePath } from './share-token';

// 공개 분야 페이지(/topics/…)의 소식. 로그인한 사람의 피드와 같은 요약(basic)과 랭킹(rankFeed)을 쓰되 사람마다 다른 것(why·읽음)은 빼고,
// 목록엔 제목·한 줄 요약·원문 링크만 보인다. 카드를 누르면 다시 쓴 전체 글(/s/<토큰>, 검색엔 안 냄)이 열린다(2026-11-10 사용자).
// 사용자가 넣은 출처(내 관심 링크, sources.custom)의 글은 대표 글로도, 출처 목록에도 쓰지 않는다.

const DAY = 24 * 3600_000;
/** 목록에 보이는 기간과 개수 */
const LIST_DAYS = 7;
const LIST_LIMIT = 12;
/** 출처 목록을 셀 기간과 개수 */
const SOURCE_DAYS = 30;
const SOURCE_LIMIT = 16;
/** 세부 주제 페이지: 한 주제는 소식이 적어 30일(읽어 둔 기간 전부)에서 고른다 */
const DETAIL_DAYS = 30;
const DETAIL_LIMIT = 15;
/** 세부 주제 페이지를 검색에 내는 최소 소식 수(이보다 적으면 noindex·사이트맵에서 뺌, 얇은 페이지가 색인되지 않게) */
export const DETAIL_MIN_ITEMS = 3;

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
  /** 카드를 누르면 여는 1분 요약 전체 글(/s/<토큰>, 공유 페이지와 같은 화면, 2026-11-10 사용자) */
  href: string;
  /** 지난 소식에서: 이 소식이 가장 가깝게 붙은 공개 분야 id(여러 분야를 섞어 보일 때 이름표) */
  field?: string;
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
  impact: Impact | null;
  published_at: string | null;
  created_at: string;
  clusters: {
    first_seen_at: string;
    size: number;
    is_video: boolean;
    rep_item_id: number | null;
    rep: { views: number | null; hn_points: number | null; published_at: string | null; sources: { weight: number; lang: string } | null } | null;
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

type TagRow = { cluster_id: number; topic_id: string; relevance: number };

/**
 * 지난 30일 요약된 소식과, 그 소식에 붙은 공개 분야 토픽(DB에서 읽은 그대로). 10분 동안 다시 읽지 않는다(2026-11-11 성능 5번).
 * 전에는 분야·세부 주제 정리(cachedDigest, 27가지)가 한 시간마다 따로 새로 만들 때마다 이 무거운 읽기(평균 0.27초)를 했다. 30일 소식이 400여 개(약 0.3MB)라 데이터 캐시에 들어간다
 */
const recentRaw = unstable_cache(
  async (): Promise<{ summaries: SummaryRow[]; tags: TagRow[] }> => {
    const since = new Date(Date.now() - SOURCE_DAYS * DAY).toISOString();
    const summaries = must(
      await db
        .from('summaries')
        .select('cluster_id,title,short,impact,published_at,created_at,clusters!inner(first_seen_at,size,is_video,skip_reason,rep_item_id,rep:items!clusters_rep_item_id_fkey(views,hn_points,published_at,sources(weight,lang)))')
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
      async (ids) => must(await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', ids).in('topic_id', topicIds), 'public cluster_topics') as TagRow[],
    );
    return { summaries, tags };
  },
  ['public-recent-v1'],
  { revalidate: 600 },
);

/** 위 자료와 소식마다 붙은 토픽 표. 한 번 그릴 때 한 번만 만든다 */
const recent = cache(async () => {
  const { summaries, tags } = await recentRaw();
  const topicsOf = new Map<number, { topicId: string; relevance: number }[]>();
  for (const t of tags) (topicsOf.get(t.cluster_id) ?? topicsOf.set(t.cluster_id, []).get(t.cluster_id)!).push({ topicId: t.topic_id, relevance: t.relevance });
  return { summaries, topicsOf };
});

const dateOf = (s: SummaryRow) => s.published_at ?? s.clusters.first_seen_at;

/**
 * 한 분야의 공개 소식(지난 7일, 최대 12개, 이슈도 순)과 출처 목록. 페이지 목록은 2026-11-10부터 지난 소식(publicArchive)이고 이건 출처 목록에 쓴다.
 * 분야·주제 페이지가 요청마다 그려져서 한 시간 들고 있는다
 */
export function publicTopicDigest(topic: PublicTopic): Promise<PublicTopicDigest> {
  return cachedDigest([topic.id, ...childrenOf(topic.id).map((c) => c.id)], LIST_DAYS, LIST_LIMIT, 3);
}

const cachedDigest = unstable_cache((ids: string[], listDays: number, limit: number, maxPerTopic: number) => digest(new Set(ids), listDays, limit, maxPerTopic), ['public-digest-v1'], {
  revalidate: 3600,
});

/** 세부 주제 하나의 공개 소식(지난 30일, 최대 15개)과 출처 목록(분야처럼 출처 목록에 쓴다) */
export function publicDetailDigest(detail: PublicDetail): Promise<PublicTopicDigest> {
  return cachedDigest([detail.id], DETAIL_DAYS, DETAIL_LIMIT, DETAIL_LIMIT);
}

/** 세부 주제마다 지난 30일 소식 수(랭킹이 받는 관련도 이상)와 마지막 요약 시각. 사이트맵·noindex 판단에 쓴다(가볍게, 이미 읽은 것만) */
export async function publicDetailStats(): Promise<Map<string, { count: number; updatedAt: string }>> {
  const { summaries, topicsOf } = await recent();
  const out = new Map<string, { count: number; updatedAt: string }>();
  for (const d of PUBLIC_DETAILS) {
    let count = 0;
    let updatedAt = '';
    for (const s of summaries) {
      if (!topicsOf.get(s.cluster_id)?.some((t) => t.topicId === d.id && t.relevance >= MIN_RELEVANCE)) continue;
      count++;
      if (s.created_at > updatedAt) updatedAt = s.created_at;
    }
    if (count) out.set(d.id, { count, updatedAt });
  }
  return out;
}

async function digest(ids: ReadonlySet<string>, listDays: number, limit: number, maxPerTopic: number): Promise<PublicTopicDigest> {
  const { summaries, topicsOf } = await recent();
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

  // 목록: 기간 안의 소식을 이 분야(주제) 전체를 고른 사람의 순서로
  const now = new Date();
  const weekAgo = now.getTime() - listDays * DAY;
  const weights = Object.fromEntries([...ids].map((id) => [id, 1]));
  const candidates: RankCandidate[] = mine
    .filter((s) => Date.parse(s.clusters.first_seen_at) >= weekAgo && publicMembers.has(s.cluster_id))
    .map((s) => {
      const rep = s.clusters.rep;
      return {
        id: s.cluster_id,
        ageHours: (now.getTime() - Date.parse(s.clusters.first_seen_at)) / 3600_000,
        sourceWeight: rep?.sources?.weight ?? 1,
        lang: rep?.sources?.lang,
        popularity: rep ? popularityBoost({ sourceWeight: 1, views: rep.views, hnPoints: rep.hn_points, publishedAt: rep.published_at }, now) : 1,
        size: s.clusters.size,
        isVideo: s.clusters.is_video,
        topics: topicsOf.get(s.cluster_id)!.filter((t) => ids.has(t.topicId)),
        impact: s.impact,
      };
    });
  const byId = new Map(mine.map((s) => [s.cluster_id, s]));
  const ranked = rankFeed(candidates, weights, new Set(), { limit, maxPerTopic, maxVideos: 3 });

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
        href: sharePath(clusterId),
      };
    }),
    sources,
    updatedAt: mine.reduce((a, s) => (s.created_at > a ? s.created_at : a), mine[0]!.created_at),
  };
}

/**
 * 소식 목록(2026-11-10 사용자 결정 '지난 소식, 공개는 지금처럼' → '이번주, 지난 주 구분하지말고 전체 리스트 하나로', 맹고-문서/검색-노출.md):
 * 1분 요약·분야·세부 주제 페이지의 목록. 지금까지 요약한 이 분야(주제) 소식 전부를
 * 맹고가 모은 날 최신순으로 한 쪽에 ARCHIVE_PAGE_SIZE개씩. 공개 범위는 위 목록과 같다(제목·한 줄 요약·출처·원문 링크).
 * 요약된 묶음은 지우지 않아서(데이터-보존-정책.md) 처음 요약한 날까지 거슬러 볼 수 있다. 사용자가 넣은 출처 글만 있는 소식은 뺀다.
 * 같은 조건은 한 시간 동안 다시 읽지 않는다(검색 로봇이 쪽을 넘겨도 DB를 매번 읽지 않게)
 */
export const ARCHIVE_PAGE_SIZE = 20;

export interface PublicArchive {
  items: PublicTopicItem[];
  /** 조건에 맞는 소식 수 */
  total: number;
}

interface ArchiveRow {
  cluster_id: number;
  title: string;
  short: string;
  published_at: string | null;
  clusters: { first_seen_at: string; rep_item_id: number | null; cluster_topics: { topic_id: string; relevance: number }[]; items: ItemRow[] };
}

/** 하루의 시작(한국 시각 0시)을 ISO로. day는 'YYYY-MM-DD' */
const kstStart = (day: string) => new Date(`${day}T00:00:00+09:00`).toISOString();
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + DAY).toISOString().slice(0, 10);

const archiveQuery = unstable_cache(
  async (topicIds: string[], page: number, from: string | null, to: string | null): Promise<PublicArchive> => {
    const query = (head: boolean) => {
      let q = db
        .from('summaries')
        .select(
          'cluster_id,title,short,published_at,clusters!inner(first_seen_at,rep_item_id,cluster_topics!inner(topic_id,relevance),items!items_cluster_id_fkey!inner(id,cluster_id,canonical_url,kind,sources!inner(name,custom)))',
          { count: 'exact', head },
        )
        .eq('tier', 'basic')
        .is('clusters.skip_reason', null)
        .in('clusters.cluster_topics.topic_id', topicIds)
        .gte('clusters.cluster_topics.relevance', MIN_RELEVANCE)
        .eq('clusters.items.sources.custom', false);
      if (from) q = q.gte('clusters.first_seen_at', kstStart(from));
      if (to) q = q.lt('clusters.first_seen_at', kstStart(nextDay(to)));
      return q;
    };
    const start = (page - 1) * ARCHIVE_PAGE_SIZE;
    const res = await query(false)
      .order('clusters(first_seen_at)', { ascending: false })
      .order('cluster_id', { ascending: false })
      .range(start, start + ARCHIVE_PAGE_SIZE - 1);
    // 마지막 쪽 너머를 달라고 하면 PostgREST가 416(PGRST103)으로 답한다. 그때는 수만 센다
    if (res.error?.code === 'PGRST103') {
      const head = await query(true);
      if (head.error) throw new Error(`public archive count: ${head.error.message}`);
      return { items: [], total: head.count ?? 0 };
    }
    const rows = must(res, 'public archive') as unknown as ArchiveRow[];
    return {
      total: res.count ?? rows.length,
      items: rows.map((s) => {
        const members = s.clusters.items;
        const rep = members.find((m) => m.id === s.clusters.rep_item_id) ?? members[0]!;
        const others = [...new Set(members.filter((m) => m !== rep).map((m) => m.sources!.name).filter((n) => n !== rep.sources!.name))];
        const top = [...s.clusters.cluster_topics].sort((a, b) => b.relevance - a.relevance)[0];
        return {
          field: top ? fieldOf(top.topic_id) : undefined,
          clusterId: s.cluster_id,
          title: s.title,
          short: s.short,
          url: rep.canonical_url,
          kind: rep.kind,
          sourceLabel: rep.sources!.name,
          coverage: others.length === 0 ? undefined : others.length === 1 ? `${others[0]}에서도 다뤘어요` : `${others[0]} 외 ${others.length - 1}곳에서도 다뤘어요`,
          date: s.published_at ?? s.clusters.first_seen_at,
          href: sharePath(s.cluster_id),
        };
      }),
    };
  },
  ['public-archive-v3'],
  { revalidate: 3600 },
);

/** 세부 주제 id → 공개 분야 id */
const fieldOf = (topicId: string) => PUBLIC_DETAILS.find((d) => d.id === topicId)?.group.id ?? topicId;

/**
 * 지난 소식 한 쪽. topic이 없으면 공개 분야 다섯 개 전부(1분 요약 아래, 2026-11-10 사용자 '그냥 전체 보여지게해'),
 * 분야면 그 세부 주제까지, 세부 주제면 그 주제만. from·to는 한국 날짜 'YYYY-MM-DD'(둘 다 포함)
 */
export function publicArchive(topic: PublicTopic | PublicDetail | null, opts: { page: number; from?: string; to?: string }): Promise<PublicArchive> {
  const groups = topic ? ('group' in topic ? null : [topic]) : PUBLIC_TOPICS;
  const ids = groups ? groups.flatMap((g) => [g.id, ...childrenOf(g.id).map((c) => c.id)]) : [topic!.id];
  return archiveQuery(ids, opts.page, opts.from ?? null, opts.to ?? null);
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
