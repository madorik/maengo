import { excludesCluster, popularityBoost, type Impact, type RankCandidate } from '@maengo/core/feed';
import { rankingWeights, TOPICS } from '@maengo/core/topics';
import type { FeedbackKind, Plan, Topic } from '@maengo/core/types';
import { db, check, fromVector, inChunks, selectAll } from './db';
import { getPlans } from './plans';
import { cosine } from './vec';
import { HOUR, type Ctx } from './ctx';

// 랭킹에 필요한 유저·후보 데이터를 읽는다. summarize(누구에게 요약해 줄지)와 rank(오늘 피드)가 같이 쓴다.

export interface Audience {
  id: string;
  plan: Plan;
  /** 하루 소식 수: 무료 1, 플러스·체험 10 (웹 entitlements와 같다) */
  dailyItems: number;
  weights: Record<string, number>;
  exclude: Set<number>;
  /** 이미 알아요를 누른 소식(비슷한 소식도 뺀다) */
  known: number[];
  /** 알림 받을 시각(KST 'HH:MM'). 이 시각이 되면 오늘 피드를 만든다(slot.ts) */
  notifyAt: string;
}

/** 체험 기간이 끝났으면 무료로 본다(결제 단계가 plan을 바꾸기 전까지) */
function effectivePlan(plan: Plan, premiumUntil: string | null, now: Date): Plan {
  if (plan === 'plus' && premiumUntil && Date.parse(premiumUntil) < now.getTime()) return 'free';
  return plan;
}

/**
 * 관심사를 고른 유저들. only를 주면 그 사람(들)만:
 * 웹에서 "오늘 맹고 받기"를 누른 한 명, 30분 작업(slot.ts)에서 알림 시각이 된 사람들
 */
export async function loadAudience(ctx: Ctx, only?: string | string[]): Promise<Audience[]> {
  if (Array.isArray(only) && !only.length) return [];
  let query = db.from('profiles').select('id,plan,premium_until,notify_at').not('onboarded_at', 'is', null);
  if (typeof only === 'string') query = query.eq('id', only);
  else if (only) query = query.in('id', only);
  const profiles = check(await query, 'profiles') as { id: string; plan: Plan; premium_until: string | null; notify_at: string }[];
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.id);
  const byId = new Map<string, Audience>();
  // 하루 맹고(소식 수)는 plans 표 값
  const plans = await getPlans();
  for (const p of profiles) {
    const plan = effectivePlan(p.plan, p.premium_until, ctx.now);
    byId.set(p.id, { id: p.id, plan, dailyItems: plans.get(plan)!.dailyItems, weights: {}, exclude: new Set(), known: [], notifyAt: String(p.notify_at).slice(0, 5) });
  }
  const topics = await selectAll<{ user_id: string; topic_id: string; weight: number; slot: number | null }>((f, t) =>
    db.from('user_topics').select('user_id,topic_id,weight,slot').in('user_id', ids).range(f, t),
  );
  const rowsOf = new Map<string, typeof topics>();
  for (const r of topics) (rowsOf.get(r.user_id) ?? rowsOf.set(r.user_id, []).get(r.user_id)!).push(r);
  // 내 관심 링크는 지금 플랜의 개수까지만 고른다(Premium·체험이 끝나면 Free 0개라 링크 글을 더 주지 않는다. 웹 feed.ts와 같은 규칙)
  for (const [userId, rows] of rowsOf) {
    const a = byId.get(userId)!;
    a.weights = rankingWeights(rows, plans.get(a.plan)!.linkLimit);
  }
  // 이미 받은 소식은 다시 주지 않는다(오늘 피드를 다시 만들 때는 오늘 것만 빼고)
  const feeds = await selectAll<{ user_id: string; cluster_id: number; date: string }>((f, t) => db.from('feeds').select('user_id,cluster_id,date').in('user_id', ids).range(f, t));
  // 오늘 날짜 피드는 다시 만들 수 있으니(force, 웹 임시 피드) 빼지 않는다
  for (const r of feeds) if (r.date !== ctx.date) byId.get(r.user_id)!.exclude.add(r.cluster_id);
  const reads = await selectAll<{ user_id: string; cluster_id: number; read_at: string | null; listened_at: string | null }>((f, t) =>
    db.from('reads').select('user_id,cluster_id,read_at,listened_at').in('user_id', ids).range(f, t),
  );
  for (const r of reads) if (r.read_at || r.listened_at) byId.get(r.user_id)!.exclude.add(r.cluster_id);
  const feedback = await selectAll<{ user_id: string; cluster_id: number; kind: FeedbackKind }>((f, t) => db.from('feedback').select('user_id,cluster_id,kind').in('user_id', ids).range(f, t));
  for (const r of feedback) {
    const a = byId.get(r.user_id)!;
    if (excludesCluster(r.kind)) a.exclude.add(r.cluster_id);
    if (r.kind === 'known') a.known.push(r.cluster_id);
  }
  return [...byId.values()].filter((a) => Object.keys(a.weights).length > 0);
}

/** 출처별 가중치와 언어(대표 글의 출처로 후보 점수를 매긴다. 한국어는 rankFeed가 더 준다, core/feed/quality.ts langBoost) */
async function sourceTraits(): Promise<{ weights: Map<number, number>; langs: Map<number, string> }> {
  const rows = check(await db.from('sources').select('id,weight,lang'), 'sources') as { id: number; weight: number; lang: string }[];
  return { weights: new Map(rows.map((r) => [r.id, r.weight])), langs: new Map(rows.map((r) => [r.id, r.lang])) };
}

export interface Candidate extends RankCandidate {
  summarized: boolean;
  centroid: number[] | null;
}

/**
 * 영상 요약 예산이 없는 곳(배송·지금 받기·하나 더 받기는 videos: 0)에서 고를 수 있는 후보: 요약된 소식, 아니면 글.
 * 요약 안 된 영상은 summarizeCluster가 미뤄서('deferred') 골라 봐야 그 자리가 빈다(2026-10-20 Premium이 3개만 받은 원인)
 */
export const summarizable = (c: Candidate): boolean => c.summarized || !c.isVideo;

/**
 * 묶음의 지금 분류. 요약하면 AI가 임베딩으로 붙인 분류를 지우고 다시 정하므로(summarizeCluster), 요약한 뒤에 읽어 후보의 topics를 바꾼다.
 * 안 바꾸면 '부산교통공사 파업'이 임베딩 분류(코스피)대로 코스피 소식으로 나갔다(2026-10-23, 요약 뒤 분류는 사회뿐)
 */
export async function clusterTopics(clusterId: number): Promise<{ topicId: string; relevance: number }[]> {
  const rows = check(await db.from('cluster_topics').select('topic_id,relevance').eq('cluster_id', clusterId), 'cluster_topics') as { topic_id: string; relevance: number }[];
  return rows.map((r) => ({ topicId: r.topic_id, relevance: r.relevance }));
}

/** 요약하며 AI가 매긴 소식의 무게(core/feed/impact.ts). 요약한 뒤 읽어 후보의 impact를 바꾼다(요약 전엔 제목으로만 봤다) */
export async function summaryImpact(clusterId: number): Promise<Impact | null> {
  const row = check(await db.from('summaries').select('impact').eq('cluster_id', clusterId).eq('tier', 'basic').maybeSingle(), 'summary impact') as { impact: Impact | null } | null;
  return row?.impact ?? null;
}

/** 묶음의 대표 글. 출처 가중치와 인기(조회수·점수)를 랭킹에 넘긴다 */
interface RepItem {
  id: number;
  source_id: number | null;
  views: number | null;
  hn_points: number | null;
  published_at: string | null;
  title: string;
}

function popularityOf(rep: RepItem | undefined, now: Date): number {
  return rep ? popularityBoost({ sourceWeight: 1, views: rep.views, hnPoints: rep.hn_points, publishedAt: rep.published_at }, now) : 1;
}

/**
 * 지난 7일 묶음 중 토픽이 붙은 것. 요약이 없는 것은 freshHours 안의 것만.
 * 중심 벡터(묶음당 수 KB)는 "이미 알아요"와 비슷한 소식을 뺄 때만 필요해서 centroids로 고른다.
 */
export async function loadCandidates(ctx: Ctx, { freshHours = ctx.windowHours, centroids = true, sinceHours = 7 * 24 } = {}): Promise<Candidate[]> {
  // 묶음은 sinceHours(기본 7일) 안의 것, 요약이 아직 없는 묶음은 freshHours 안의 것만 후보로 둔다
  const since = new Date(ctx.now.getTime() - sinceHours * HOUR).toISOString();
  const cols = `id,first_seen_at,size,is_video,rep_item_id${centroids ? ',centroid' : ''}`;
  const clusters = await selectAll<{ id: number; first_seen_at: string; size: number; is_video: boolean; rep_item_id: number | null; centroid?: unknown }>((f, t) =>
    db.from('clusters').select(cols).is('skip_reason', null).gte('first_seen_at', since).order('id').range(f, t),
  );
  const ids = clusters.map((c) => c.id);
  const topics = new Map<number, { topicId: string; relevance: number }[]>();
  const summarized = new Set<number>();
  const impacts = new Map<number, Impact | null>();
  const repItems = new Map<number, RepItem>();
  await inChunks(ids, 200, async (chunk) => {
    const ct = check(await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', chunk), 'cluster_topics') as { cluster_id: number; topic_id: string; relevance: number }[];
    for (const r of ct) (topics.get(r.cluster_id) ?? topics.set(r.cluster_id, []).get(r.cluster_id)!).push({ topicId: r.topic_id, relevance: r.relevance });
    const s = check(await db.from('summaries').select('cluster_id,impact').eq('tier', 'basic').in('cluster_id', chunk), 'summaries') as { cluster_id: number; impact: Impact | null }[];
    for (const r of s) {
      summarized.add(r.cluster_id);
      impacts.set(r.cluster_id, r.impact);
    }
  });
  const repIds = clusters.map((c) => c.rep_item_id).filter((x): x is number => x != null);
  await inChunks(repIds, 200, async (chunk) => {
    const rows = check(await db.from('items').select('id,source_id,views,hn_points,published_at,title').in('id', chunk), 'items') as RepItem[];
    for (const r of rows) repItems.set(r.id, r);
  });
  const { weights, langs } = await sourceTraits();

  const freshSince = ctx.now.getTime() - freshHours * HOUR;
  return clusters
    .filter((c) => topics.has(c.id) && (summarized.has(c.id) || Date.parse(c.first_seen_at) >= freshSince))
    .map((c) => ({
      id: c.id,
      ageHours: (ctx.now.getTime() - Date.parse(c.first_seen_at)) / HOUR,
      sourceWeight: weights.get(repItems.get(c.rep_item_id ?? -1)?.source_id ?? -1) ?? 1,
      lang: langs.get(repItems.get(c.rep_item_id ?? -1)?.source_id ?? -1),
      popularity: popularityOf(repItems.get(c.rep_item_id ?? -1), ctx.now),
      size: c.size,
      isVideo: c.is_video,
      topics: topics.get(c.id)!,
      title: repItems.get(c.rep_item_id ?? -1)?.title ?? null,
      impact: impacts.get(c.id) ?? null,
      summarized: summarized.has(c.id),
      centroid: fromVector(c.centroid),
    }));
}

/**
 * 이 관심사들에 붙은 묶음만, untilHours 전 ~ sinceHours 전 사이에서 최근 것부터 limit개(요약 여부 상관없이). 알림 시각에 고를 게 모자랄 때
 * 기간을 넓혀(사흘~일주일 → 일주일~한 달) 더 오래된 쪽을 차례로 찾는 데 쓴다. 최근 것이 많아도 오래된 쪽까지 닿게 구간으로 읽는다.
 * loadCandidates는 기간 안의 묶음을 전부 읽어서 넓은 기간엔 무겁다
 */
export async function loadTopicCandidates(
  ctx: Ctx,
  topicIds: string[],
  { sinceHours, untilHours = 0, limit = 400, centroids = false }: { sinceHours: number; untilHours?: number; limit?: number; centroids?: boolean },
): Promise<Candidate[]> {
  if (!topicIds.length) return [];
  const since = new Date(ctx.now.getTime() - sinceHours * HOUR).toISOString();
  const until = new Date(ctx.now.getTime() - untilHours * HOUR).toISOString();
  type Row = { cluster_id: number; topic_id: string; relevance: number; clusters: { id: number; first_seen_at: string; size: number; is_video: boolean; rep_item_id: number | null; centroid?: unknown } };
  const rows = check(
    await db
      .from('cluster_topics')
      .select(`cluster_id,topic_id,relevance,clusters!inner(id,first_seen_at,size,is_video,rep_item_id,skip_reason${centroids ? ',centroid' : ''})`)
      .in('topic_id', topicIds)
      .gte('clusters.first_seen_at', since)
      .lt('clusters.first_seen_at', until)
      .is('clusters.skip_reason', null)
      .order('cluster_id', { ascending: false })
      .limit(limit),
    'topic candidates',
  ) as unknown as Row[];
  const byCluster = new Map<number, { c: Row['clusters']; topics: { topicId: string; relevance: number }[] }>();
  for (const r of rows) (byCluster.get(r.cluster_id) ?? byCluster.set(r.cluster_id, { c: r.clusters, topics: [] }).get(r.cluster_id)!).topics.push({ topicId: r.topic_id, relevance: r.relevance });
  const ids = [...byCluster.keys()];
  const summarized = new Set<number>();
  const impacts = new Map<number, Impact | null>();
  const repItems = new Map<number, RepItem>();
  await inChunks(ids, 200, async (chunk) => {
    const s = check(await db.from('summaries').select('cluster_id,impact').eq('tier', 'basic').in('cluster_id', chunk), 'summaries') as { cluster_id: number; impact: Impact | null }[];
    for (const r of s) {
      summarized.add(r.cluster_id);
      impacts.set(r.cluster_id, r.impact);
    }
  });
  const repIds = [...byCluster.values()].map((v) => v.c.rep_item_id).filter((x): x is number => x != null);
  await inChunks(repIds, 200, async (chunk) => {
    const items = check(await db.from('items').select('id,source_id,views,hn_points,published_at,title').in('id', chunk), 'items') as RepItem[];
    for (const r of items) repItems.set(r.id, r);
  });
  const { weights, langs } = await sourceTraits();
  return [...byCluster.values()].map(({ c, topics }) => ({
    id: c.id,
    ageHours: (ctx.now.getTime() - Date.parse(c.first_seen_at)) / HOUR,
    sourceWeight: weights.get(repItems.get(c.rep_item_id ?? -1)?.source_id ?? -1) ?? 1,
    lang: langs.get(repItems.get(c.rep_item_id ?? -1)?.source_id ?? -1),
    popularity: popularityOf(repItems.get(c.rep_item_id ?? -1), ctx.now),
    size: c.size,
    isVideo: c.is_video,
    topics,
    title: repItems.get(c.rep_item_id ?? -1)?.title ?? null,
    impact: impacts.get(c.id) ?? null,
    summarized: summarized.has(c.id),
    centroid: fromVector(c.centroid),
  }));
}

/**
 * 후보 중 중심 벡터가 없는 것만 읽어 채운다(같은 사건 빼기, core/feed rankDistinct가 추린 후보에 부른다).
 * 배송은 후보 객체를 여러 사람이 나눠 쓰므로 한 번 읽은 벡터는 다음 사람이 다시 읽지 않는다
 */
export async function fillCentroids(candidates: Candidate[]): Promise<void> {
  const need = candidates.filter((c) => !c.centroid);
  await inChunks(need, 100, async (chunk) => {
    const rows = check(await db.from('clusters').select('id,centroid').in('id', chunk.map((c) => c.id)), 'centroids') as { id: number; centroid: unknown }[];
    const byId = new Map(rows.map((r) => [r.id, fromVector(r.centroid)]));
    for (const c of chunk) c.centroid = byId.get(c.id) ?? null;
  });
}

/** 알아요를 누른 소식과 코사인 ≥ 0.9인 후보도 뺀다(PLAN.md 6.3) */
export async function withSimilarExcluded(a: Audience, candidates: Candidate[]): Promise<Set<number>> {
  if (!a.known.length) return a.exclude;
  const rows = check(await db.from('clusters').select('id,centroid').in('id', a.known), 'known clusters') as { id: number; centroid: unknown }[];
  const knownVecs = rows.map((r) => fromVector(r.centroid)).filter((v): v is number[] => !!v);
  const out = new Set(a.exclude);
  for (const c of candidates) if (c.centroid && knownVecs.some((k) => cosine(c.centroid!, k) >= 0.9)) out.add(c.id);
  return out;
}

/**
 * 이번 실행의 토픽 사전: 코드 사전 + 누군가 내 관심사에 올린 직접 입력 관심사(custom).
 * 태그(임베딩 비교)와 요약(AI가 토픽 고르기)이 같이 쓴다. 한 실행에서 한 번만 읽는다.
 */
export async function dictionary(ctx: Ctx): Promise<Topic[]> {
  if (ctx.topics) return ctx.topics;
  const used = await selectAll<{ topic_id: string }>((f, t) => db.from('user_topics').select('topic_id').like('topic_id', 'c-%').range(f, t));
  const ids = [...new Set(used.map((r) => r.topic_id))];
  const custom: Topic[] = [];
  await inChunks(ids, 200, async (chunk) => {
    const rows = check(await db.from('topics').select('id,name,aliases').in('id', chunk), 'custom topics') as { id: string; name: string; aliases: string[] }[];
    custom.push(...rows.map((r) => ({ id: r.id, name: r.name, aliases: r.aliases ?? [] })));
  });
  ctx.topics = [...TOPICS, ...custom];
  if (custom.length) ctx.log(`사전: 직접 입력 관심사 ${custom.length}개 포함(${custom.map((c) => c.name).slice(0, 5).join(', ')}${custom.length > 5 ? ' …' : ''})`);
  return ctx.topics;
}
