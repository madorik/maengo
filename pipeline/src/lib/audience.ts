import { dailyItemsFor } from '@maengo/core/plans';
import { excludesCluster, type RankCandidate } from '@maengo/core/feed';
import { tierOf } from '@maengo/core/ai';
import { TOPICS } from '@maengo/core/topics';
import type { FeedbackKind, Plan, Tier, Topic } from '@maengo/core/types';
import { db, check, fromVector, inChunks, selectAll } from './db';
import { cosine } from './vec';
import { HOUR, type Ctx } from './ctx';

// 랭킹에 필요한 유저·후보 데이터를 읽는다. summarize(누구에게 요약해 줄지)와 rank(오늘 피드)가 같이 쓴다.

export interface Audience {
  id: string;
  plan: Plan;
  tier: Tier;
  /** 하루 소식 수: 무료 1, 플러스·체험 10 (웹 entitlements와 같다) */
  dailyItems: number;
  weights: Record<string, number>;
  exclude: Set<number>;
  /** 이미 알아요를 누른 소식(비슷한 소식도 뺀다) */
  known: number[];
}

/** 체험 기간이 끝났으면 무료로 본다(결제 단계가 plan을 바꾸기 전까지) */
function effectivePlan(plan: Plan, premiumUntil: string | null, now: Date): Plan {
  if (plan === 'plus' && premiumUntil && Date.parse(premiumUntil) < now.getTime()) return 'free';
  return plan;
}

/** 관심사를 고른 유저들. onlyUserId를 주면 그 한 명만(웹에서 "오늘 맹고 받기"를 누른 사람) */
export async function loadAudience(ctx: Ctx, onlyUserId?: string): Promise<Audience[]> {
  let query = db.from('profiles').select('id,plan,premium_until').not('onboarded_at', 'is', null);
  if (onlyUserId) query = query.eq('id', onlyUserId);
  const profiles = check(await query, 'profiles') as { id: string; plan: Plan; premium_until: string | null }[];
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.id);
  const byId = new Map<string, Audience>();
  for (const p of profiles) {
    const plan = effectivePlan(p.plan, p.premium_until, ctx.now);
    byId.set(p.id, { id: p.id, plan, tier: tierOf(plan), dailyItems: dailyItemsFor(plan), weights: {}, exclude: new Set(), known: [] });
  }
  const topics = await selectAll<{ user_id: string; topic_id: string; weight: number }>((f, t) => db.from('user_topics').select('user_id,topic_id,weight').in('user_id', ids).range(f, t));
  for (const r of topics) byId.get(r.user_id)!.weights[r.topic_id] = r.weight;
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

export interface Candidate extends RankCandidate {
  summarized: boolean;
  centroid: number[] | null;
}

/**
 * 지난 7일 묶음 중 토픽이 붙은 것. 요약이 없는 것은 freshHours 안의 것만.
 * 중심 벡터(묶음당 수 KB)는 "이미 알아요"와 비슷한 소식을 뺄 때만 필요해서 centroids로 고른다.
 */
export async function loadCandidates(ctx: Ctx, { freshHours = ctx.windowHours, centroids = true } = {}): Promise<Candidate[]> {
  const since = new Date(ctx.now.getTime() - 7 * 24 * HOUR).toISOString();
  const cols = `id,first_seen_at,size,is_video,rep_item_id${centroids ? ',centroid' : ''}`;
  const clusters = await selectAll<{ id: number; first_seen_at: string; size: number; is_video: boolean; rep_item_id: number | null; centroid?: unknown }>((f, t) =>
    db.from('clusters').select(cols).is('skip_reason', null).gte('first_seen_at', since).order('id').range(f, t),
  );
  const ids = clusters.map((c) => c.id);
  const topics = new Map<number, { topicId: string; relevance: number }[]>();
  const summarized = new Set<number>();
  const repSource = new Map<number, number>();
  await inChunks(ids, 200, async (chunk) => {
    const ct = check(await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', chunk), 'cluster_topics') as { cluster_id: number; topic_id: string; relevance: number }[];
    for (const r of ct) (topics.get(r.cluster_id) ?? topics.set(r.cluster_id, []).get(r.cluster_id)!).push({ topicId: r.topic_id, relevance: r.relevance });
    const s = check(await db.from('summaries').select('cluster_id').eq('tier', 'basic').in('cluster_id', chunk), 'summaries') as { cluster_id: number }[];
    for (const r of s) summarized.add(r.cluster_id);
  });
  const repIds = clusters.map((c) => c.rep_item_id).filter((x): x is number => x != null);
  await inChunks(repIds, 200, async (chunk) => {
    const rows = check(await db.from('items').select('id,source_id').in('id', chunk), 'items') as { id: number; source_id: number | null }[];
    for (const r of rows) if (r.source_id != null) repSource.set(r.id, r.source_id);
  });
  const weights = new Map((check(await db.from('sources').select('id,weight'), 'sources') as { id: number; weight: number }[]).map((s) => [s.id, s.weight]));

  const freshSince = ctx.now.getTime() - freshHours * HOUR;
  return clusters
    .filter((c) => topics.has(c.id) && (summarized.has(c.id) || Date.parse(c.first_seen_at) >= freshSince))
    .map((c) => ({
      id: c.id,
      ageHours: (ctx.now.getTime() - Date.parse(c.first_seen_at)) / HOUR,
      sourceWeight: weights.get(repSource.get(c.rep_item_id ?? -1) ?? -1) ?? 1,
      size: c.size,
      isVideo: c.is_video,
      topics: topics.get(c.id)!,
      summarized: summarized.has(c.id),
      centroid: fromVector(c.centroid),
    }));
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
