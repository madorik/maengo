import 'server-only';
import { cache } from 'react';
import { modelFor, tierOf } from '@maengo/core/ai';
import { CATEGORIES, isCategory, type CategoryId } from '@maengo/core/categories';
import { excludesCluster, feedbackDelta, rankFeed, WEIGHT_MAX, WEIGHT_MIN, type RankCandidate } from '@maengo/core/feed';
import { kstDate, kstDayLabel, kstGreetingDate, notifyTimeLabel, publishedLabel } from '@maengo/core/kst';
import { whyLead } from '@maengo/core/topics';
import { youtubeId, youtubeThumbnail } from '@maengo/core/youtube';
import type { FeedbackKind, Tier } from '@maengo/core/types';
import type { FeedItem, LibraryData, LibraryEntry, ProfileView, TodayData } from '../types';
import { ai } from './ai';
import { db, must } from './db';
import { entitlements, trialDaysLeft, type Profile } from './profile';
import { topicNames } from './topics';

// 피드 읽기. 소식(요약·why·토픽)은 일일 파이프라인(pipeline/)이 Supabase에 만들어 두고, 웹은 읽기만 한다.
// 웹에서는 LLM을 부르지 않는다. 오늘 피드가 아직 없으면(배치 전·토픽 변경 후 다시 만들기) 이미 요약된 소식으로 바로 랭킹한다.

/** 랭킹은 늘 최대치(10개)까지 저장하고, 보여 줄 개수만 플랜으로 정한다 */
const MAX_DAILY = 10;
const HOUR = 3600_000;

interface FeedRow {
  rank: number;
  clusterId: number;
  topicId: string;
}

interface FeedDay {
  date: string;
  rows: FeedRow[];
  visible: number;
}

// ---- 오늘 피드 만들기(파이프라인 rank 단계와 같은 규칙. 알아요와 비슷한 소식 빼기는 배치에서만 한다) ----

async function exclusions(userId: string, today: string): Promise<Set<number>> {
  const [feeds, reads, feedback] = await Promise.all([
    db.from('feeds').select('cluster_id,date').eq('user_id', userId).neq('date', today),
    db.from('reads').select('cluster_id,read_at,listened_at').eq('user_id', userId),
    db.from('feedback').select('cluster_id,kind').eq('user_id', userId),
  ]);
  const out = new Set<number>();
  for (const r of must(feeds, 'feeds') as { cluster_id: number }[]) out.add(r.cluster_id);
  for (const r of must(reads, 'reads') as { cluster_id: number; read_at: string | null; listened_at: string | null }[]) if (r.read_at || r.listened_at) out.add(r.cluster_id);
  for (const r of must(feedback, 'feedback') as { cluster_id: number; kind: FeedbackKind }[]) if (excludesCluster(r.kind)) out.add(r.cluster_id);
  return out;
}

async function weightsOf(userId: string): Promise<Record<string, number>> {
  const rows = must(await db.from('user_topics').select('topic_id,weight').eq('user_id', userId), 'user_topics') as { topic_id: string; weight: number }[];
  return Object.fromEntries(rows.map((r) => [r.topic_id, r.weight]));
}

/** 지난 7일 안에 요약이 끝난 소식 */
async function summarizedCandidates(): Promise<RankCandidate[]> {
  const since = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
  const rows = must(
    await db
      .from('summaries')
      .select('cluster_id, clusters!inner(first_seen_at,size,is_video,skip_reason,rep:items!clusters_rep_item_id_fkey(sources(weight)))')
      .eq('tier', 'basic')
      .gte('clusters.first_seen_at', since)
      .is('clusters.skip_reason', null),
    'candidates',
  ) as unknown as {
    cluster_id: number;
    clusters: { first_seen_at: string; size: number; is_video: boolean; rep: { sources: { weight: number } | null } | null };
  }[];
  if (!rows.length) return [];
  const topics = must(
    await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', rows.map((r) => r.cluster_id)),
    'cluster_topics',
  ) as { cluster_id: number; topic_id: string; relevance: number }[];
  const byCluster = new Map<number, { topicId: string; relevance: number }[]>();
  for (const t of topics) (byCluster.get(t.cluster_id) ?? byCluster.set(t.cluster_id, []).get(t.cluster_id)!).push({ topicId: t.topic_id, relevance: t.relevance });
  const now = Date.now();
  return rows
    .filter((r) => byCluster.has(r.cluster_id))
    .map((r) => ({
      id: r.cluster_id,
      ageHours: (now - Date.parse(r.clusters.first_seen_at)) / HOUR,
      sourceWeight: r.clusters.rep?.sources?.weight ?? 1,
      size: r.clusters.size,
      isVideo: r.clusters.is_video,
      topics: byCluster.get(r.cluster_id)!,
    }));
}

async function buildToday(profile: Profile, date: string): Promise<FeedRow[]> {
  const [candidates, weights, exclude] = await Promise.all([summarizedCandidates(), weightsOf(profile.id), exclusions(profile.id, date)]);
  const ranked = rankFeed(candidates, weights, exclude, { limit: MAX_DAILY }).map((r, i) => ({ rank: i + 1, clusterId: r.clusterId, topicId: r.topicId }));
  if (ranked.length) {
    must(
      await db.from('feeds').upsert(
        ranked.map((r) => ({ user_id: profile.id, date, rank: r.rank, cluster_id: r.clusterId, topic_id: r.topicId })),
        { onConflict: 'user_id,date,rank', ignoreDuplicates: true },
      ),
      'feeds insert',
    );
  }
  return ranked;
}

async function readDay(userId: string, date: string): Promise<FeedDay | null> {
  const [day, feeds] = await Promise.all([
    db.from('feed_days').select('visible').eq('user_id', userId).eq('date', date).maybeSingle(),
    db.from('feeds').select('rank,cluster_id,topic_id').eq('user_id', userId).eq('date', date).order('rank'),
  ]);
  const d = must(day, 'feed_days') as { visible: number } | null;
  if (!d) return null;
  const rows = (must(feeds, 'feeds') as { rank: number; cluster_id: number; topic_id: string }[]).map((r) => ({ rank: r.rank, clusterId: r.cluster_id, topicId: r.topic_id }));
  return { date, rows, visible: d.visible };
}

/** 오늘 피드. 보여 주는 개수는 지금 플랜을 따른다(체험을 시작하면 바로 10개로 늘어난다) */
const todayFeed = cache(async (profile: Profile): Promise<FeedDay> => {
  const date = kstDate();
  const limit = entitlements(profile).dailyItems;
  const day = await readDay(profile.id, date);
  if (day) {
    const visible = Math.min(day.rows.length, limit);
    if (visible !== day.visible) must(await db.from('feed_days').update({ visible }).eq('user_id', profile.id).eq('date', date), 'feed_days visible');
    return { ...day, visible };
  }
  // 아직 오늘 피드가 없다. 이미 요약된 소식으로 임시 피드를 만든다(배치가 돌면 새 소식으로 다시 만든다)
  const rows = await buildToday(profile, date);
  const visible = Math.min(rows.length, limit);
  if (rows.length) {
    must(
      await db.from('feed_days').upsert({ user_id: profile.id, date, visible, built_by: 'web' }, { onConflict: 'user_id,date', ignoreDuplicates: true }),
      'feed_days insert',
    );
  }
  return { date, rows, visible };
});

const visibleRows = (day: FeedDay | null) => (day ? day.rows.slice(0, day.visible) : []);

export async function rebuildFeed(profile: Profile) {
  const date = kstDate();
  must(await db.from('feeds').delete().eq('user_id', profile.id).eq('date', date), 'feeds delete');
  must(await db.from('feed_days').delete().eq('user_id', profile.id).eq('date', date), 'feed_days delete');
}

/** 받은 피드 전체(최신순). 오늘 것은 지금 플랜 기준 */
async function allDays(profile: Profile): Promise<FeedDay[]> {
  const today = await todayFeed(profile);
  const [days, feeds] = await Promise.all([
    db.from('feed_days').select('date,visible').eq('user_id', profile.id).neq('date', today.date).order('date', { ascending: false }),
    db.from('feeds').select('date,rank,cluster_id,topic_id').eq('user_id', profile.id).neq('date', today.date).order('rank'),
  ]);
  const rowsByDate = new Map<string, FeedRow[]>();
  for (const r of must(feeds, 'feeds') as { date: string; rank: number; cluster_id: number; topic_id: string }[]) {
    (rowsByDate.get(r.date) ?? rowsByDate.set(r.date, []).get(r.date)!).push({ rank: r.rank, clusterId: r.cluster_id, topicId: r.topic_id });
  }
  const past = (must(days, 'feed_days') as { date: string; visible: number }[]).map((d) => ({ date: d.date, visible: d.visible, rows: rowsByDate.get(d.date) ?? [] }));
  return [today, ...past];
}

/** 받은 피드 어디에서든 이 소식을 찾는다(보여 준 것만) */
async function findRow(profile: Profile, clusterId: number): Promise<{ row: FeedRow; date: string } | null> {
  const today = await todayFeed(profile);
  const hitToday = visibleRows(today).find((r) => r.clusterId === clusterId);
  if (hitToday) return { row: hitToday, date: today.date };
  const rows = must(
    await db.from('feeds').select('date,rank,topic_id').eq('user_id', profile.id).eq('cluster_id', clusterId).neq('date', today.date).order('date', { ascending: false }),
    'feeds',
  ) as { date: string; rank: number; topic_id: string }[];
  for (const r of rows) {
    const day = must(await db.from('feed_days').select('visible').eq('user_id', profile.id).eq('date', r.date).maybeSingle(), 'feed_days') as { visible: number } | null;
    if (day && r.rank <= day.visible) return { row: { rank: r.rank, clusterId, topicId: r.topic_id }, date: r.date };
  }
  return null;
}

export async function isInUserFeed(profile: Profile, clusterId: number): Promise<boolean> {
  return (await findRow(profile, clusterId)) !== null;
}

// ---- 소식 내용 ----

interface ClusterInfo {
  title: string;
  short: string;
  body: string[];
  category: CategoryId;
  author: string | null;
  publishedAt: string | null;
  scenes?: { t: string; label: string }[];
  kind: 'article' | 'video';
  url: string;
  sourceLabel: string;
  coverage?: string;
  why: Map<string, string>;
}

interface SummaryRow {
  cluster_id: number;
  tier: Tier;
  title: string;
  short: string;
  body: string[];
  category: string;
  author: string | null;
  published_at: string | null;
  scenes: { t: string; label: string }[] | null;
}

/** 소식 여러 개를 한 번에 읽는다. 등급 요약이 없으면 기본(basic) 요약을 쓴다 */
async function clusterInfo(ids: number[], tier: Tier): Promise<Map<number, ClusterInfo>> {
  const out = new Map<number, ClusterInfo>();
  if (!ids.length) return out;
  const tiers: Tier[] = tier === 'pro' ? ['pro', 'basic'] : ['basic'];
  const [summaries, whys, clusters, items] = await Promise.all([
    db.from('summaries').select('cluster_id,tier,title,short,body,category,author,published_at,scenes').in('cluster_id', ids).in('tier', tiers),
    db.from('cluster_why').select('cluster_id,topic_id,tier,why').in('cluster_id', ids).in('tier', tiers),
    db.from('clusters').select('id,rep_item_id').in('id', ids),
    db.from('items').select('id,cluster_id,canonical_url,kind,author,sources(name)').in('cluster_id', ids),
  ]);
  const rank = (t: Tier) => tiers.indexOf(t);
  const best = new Map<number, SummaryRow>();
  for (const s of must(summaries, 'summaries') as SummaryRow[]) {
    const cur = best.get(s.cluster_id);
    if (!cur || rank(s.tier) < rank(cur.tier)) best.set(s.cluster_id, s);
  }
  const why = new Map<number, Map<string, { tier: Tier; text: string }>>();
  for (const w of must(whys, 'cluster_why') as { cluster_id: number; topic_id: string; tier: Tier; why: string }[]) {
    const m = why.get(w.cluster_id) ?? why.set(w.cluster_id, new Map()).get(w.cluster_id)!;
    const cur = m.get(w.topic_id);
    if (!cur || rank(w.tier) < rank(cur.tier)) m.set(w.topic_id, { tier: w.tier, text: w.why });
  }
  const repOf = new Map((must(clusters, 'clusters') as { id: number; rep_item_id: number | null }[]).map((c) => [c.id, c.rep_item_id]));
  const members = new Map<number, { id: number; canonical_url: string; kind: 'article' | 'video'; author: string | null; sources: { name: string } | null }[]>();
  for (const it of must(items, 'items') as unknown as { id: number; cluster_id: number; canonical_url: string; kind: 'article' | 'video'; author: string | null; sources: { name: string } | null }[]) {
    (members.get(it.cluster_id) ?? members.set(it.cluster_id, []).get(it.cluster_id)!).push(it);
  }
  for (const id of ids) {
    const s = best.get(id);
    const list = members.get(id) ?? [];
    const rep = list.find((m) => m.id === repOf.get(id)) ?? list[0];
    if (!s || !rep) continue;
    const others = [...new Set(list.filter((m) => m !== rep).map((m) => m.sources?.name).filter((n): n is string => !!n && n !== rep.sources?.name))];
    out.set(id, {
      title: s.title,
      short: s.short,
      body: s.body,
      category: isCategory(s.category) ? s.category : 'etc',
      author: s.author ?? rep.author,
      publishedAt: s.published_at,
      scenes: s.scenes ?? undefined,
      kind: rep.kind,
      url: rep.canonical_url,
      sourceLabel: rep.sources?.name ?? '',
      coverage: others.length === 0 ? undefined : others.length === 1 ? `${others[0]}에서도 다뤘어요` : `${others[0]} 외 ${others.length - 1}곳에서도 다뤘어요`,
      why: new Map([...(why.get(id) ?? new Map())].map(([t, v]) => [t, v.text])),
    });
  }
  return out;
}

function toItem(row: FeedRow, date: string, c: ClusterInfo, now: Date, names: Map<string, string>): FeedItem {
  const topicName = names.get(row.topicId) ?? row.topicId;
  const videoId = c.kind === 'video' ? youtubeId(c.url) : null;
  return {
    rank: row.rank,
    clusterId: row.clusterId,
    feedDate: date,
    title: c.title,
    kind: c.kind,
    category: c.category,
    sourceLabel: c.sourceLabel,
    author: c.author ?? c.sourceLabel,
    publishedLabel: c.publishedAt ? publishedLabel(c.publishedAt, now) : '',
    coverage: c.coverage,
    url: c.url,
    thumbnail: videoId ? youtubeThumbnail(videoId) : null,
    short: c.short,
    body: c.body,
    scenes: c.scenes,
    topicId: row.topicId,
    topicName,
    // why는 파이프라인이 토픽마다 만들어 둔다. 없으면 요약으로 대신한다(웹에서 LLM을 부르지 않으려고)
    why: c.why.get(row.topicId) ?? `${whyLead(topicName)}: ${c.short}`,
  };
}

async function itemsFor(profile: Profile, rows: FeedRow[], date: string): Promise<FeedItem[]> {
  // 직접 입력한 관심사(사전에 없는 토픽)의 이름은 DB에서 찾는다
  const [info, names] = await Promise.all([clusterInfo(rows.map((r) => r.clusterId), tierOf(profile.plan)), topicNames(rows.map((r) => r.topicId))]);
  const now = new Date();
  return rows.flatMap((r) => {
    const c = info.get(r.clusterId);
    return c ? [toItem(r, date, c, now, names)] : [];
  });
}

export async function feedItems(profile: Profile, date = kstDate()): Promise<FeedItem[]> {
  const day = date === kstDate() ? await todayFeed(profile) : await readDay(profile.id, date);
  return itemsFor(profile, visibleRows(day), date);
}

/** 상세 화면용. 오늘 것이 아니어도 받은 적 있는 소식이면 연다 */
export const findFeedItem = cache(async (profile: Profile, clusterId: number): Promise<{ item: FeedItem; isToday: boolean } | null> => {
  const found = await findRow(profile, clusterId);
  if (!found) return null;
  const [item] = await itemsFor(profile, [found.row], found.date);
  return item ? { item, isToday: found.date === kstDate() } : null;
});

/** 전체 글까지 다 읽는 시간. 한국어 읽기 속도를 분당 400자로 어림한다. */
function readMinutes(items: FeedItem[]): number {
  const chars = items.reduce((n, i) => n + i.body.join('').length + i.why.length, 0);
  return Math.max(1, Math.round(chars / 400));
}

async function readsAndFeedback(userId: string) {
  const [reads, feedback] = await Promise.all([
    db.from('reads').select('cluster_id,read_at,listened_at').eq('user_id', userId),
    db.from('feedback').select('cluster_id,kind').eq('user_id', userId),
  ]);
  return {
    reads: must(reads, 'reads') as { cluster_id: number; read_at: string | null; listened_at: string | null }[],
    feedback: must(feedback, 'feedback') as { cluster_id: number; kind: FeedbackKind }[],
  };
}

/** 오늘 날짜로 배치가 성공한 적이 있는지(없으면 아직 오늘 소식을 고르기 전) */
async function batchRanToday(date: string): Promise<boolean> {
  const { count } = await db.from('pipeline_runs').select('id', { count: 'exact', head: true }).eq('date', date).eq('ok', true);
  return (count ?? 0) > 0;
}

export async function getTodayData(profile: Profile): Promise<TodayData> {
  const day = await todayFeed(profile);
  const [items, { reads, feedback }] = await Promise.all([itemsFor(profile, visibleRows(day), day.date), readsAndFeedback(profile.id)]);
  const emptyReason = items.length ? null : (await batchRanToday(day.date)) ? 'exhausted' : 'waiting';
  const topicNames = [...new Set(items.map((i) => i.topicName))].slice(0, 3);
  return {
    date: day.date,
    signature: `${day.date}:${items.map((i) => i.clusterId).join(',')}`,
    greetingDate: kstGreetingDate(),
    topicNames,
    readMinutes: readMinutes(items),
    notifyLabel: notifyTimeLabel(profile.notifyAt),
    dailyLimit: entitlements(profile).dailyItems,
    hiddenCount: day.rows.length - day.visible,
    emptyReason,
    items,
    read: reads.filter((r) => r.read_at).map((r) => r.cluster_id),
    listened: reads.filter((r) => r.listened_at).map((r) => r.cluster_id),
    feedback: Object.fromEntries(feedback.map((f) => [f.cluster_id, f.kind])),
  };
}

export const LIBRARY_PAGE_SIZE = 10;

/** 보관함: 지금까지 받은 피드 전체(최신순)를 카테고리로 거르고 페이지로 나눈다 */
export async function getLibrary(profile: Profile, { page, category }: { page: number; category: CategoryId | null }): Promise<LibraryData> {
  const now = new Date();
  const days = await allDays(profile);
  const rows = days.flatMap((d) => visibleRows(d).map((row) => ({ row, date: d.date })));
  const [info, { reads }] = await Promise.all([clusterInfo([...new Set(rows.map((r) => r.row.clusterId))], tierOf(profile.plan)), readsAndFeedback(profile.id)]);
  const readMap = new Map(reads.map((r) => [r.cluster_id, r]));
  const all: LibraryEntry[] = rows.flatMap(({ row, date }) => {
    const c = info.get(row.clusterId);
    if (!c) return [];
    return [{
      clusterId: row.clusterId,
      feedDate: date,
      title: c.title,
      short: c.short,
      kind: c.kind,
      category: c.category,
      sourceLabel: c.sourceLabel,
      author: c.author ?? c.sourceLabel,
      publishedLabel: c.publishedAt ? publishedLabel(c.publishedAt, now) : '',
      read: !!readMap.get(row.clusterId)?.read_at,
      listened: !!readMap.get(row.clusterId)?.listened_at,
    }];
  });

  const counts = new Map<CategoryId, number>();
  for (const e of all) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const filtered = category ? all.filter((e) => e.category === category) : all;
  const pageCount = Math.max(1, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const slice = filtered.slice((current - 1) * LIBRARY_PAGE_SIZE, current * LIBRARY_PAGE_SIZE);

  const groups: LibraryData['groups'] = [];
  for (const e of slice) {
    const last = groups.at(-1);
    if (last?.date === e.feedDate) last.entries.push(e);
    else groups.push({ date: e.feedDate, label: kstDayLabel(e.feedDate, now), entries: [e] });
  }

  return {
    total: all.length,
    filteredTotal: filtered.length,
    page: current,
    pageCount,
    category,
    categories: CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ id: c.id, label: c.label, count: counts.get(c.id)! })),
    groups,
  };
}

export function toProfileView(p: Profile): ProfileView {
  return {
    displayName: p.displayName,
    provider: p.provider,
    email: p.email,
    demo: p.demo,
    plan: p.plan,
    trialDaysLeft: trialDaysLeft(p),
    audio: entitlements(p).audio,
    dailyItems: entitlements(p).dailyItems,
    persona: p.persona,
    voice: p.voice,
    autoNext: p.autoNext,
    skipRead: p.skipRead,
    model: modelFor(tierOf(p.plan)),
    aiProvider: ai.provider,
  };
}

/** 피드백 저장과 토픽 가중치 갱신(PLAN.md 6.3). kind가 null이면 피드백을 지운다. */
export async function setFeedback(profile: Profile, clusterId: number, kind: FeedbackKind | null) {
  const clamp = (w: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w));
  const weights = await weightsOf(profile.id);
  const prev = must(
    await db.from('feedback').select('topic_id,delta').eq('user_id', profile.id).eq('cluster_id', clusterId).maybeSingle(),
    'feedback',
  ) as { topic_id: string | null; delta: number } | null;
  const updates = new Map<string, number>();
  if (prev) {
    if (prev.topic_id && weights[prev.topic_id] !== undefined) {
      weights[prev.topic_id] = clamp(weights[prev.topic_id]! - prev.delta);
      updates.set(prev.topic_id, weights[prev.topic_id]!);
    }
    must(await db.from('feedback').delete().eq('user_id', profile.id).eq('cluster_id', clusterId), 'feedback delete');
  }
  if (kind) {
    const topicId = (await findRow(profile, clusterId))?.row.topicId ?? null;
    // 관심 토픽에서 이미 뺀 토픽이면 가중치는 건드리지 않는다
    const current = topicId ? weights[topicId] : undefined;
    const delta = current === undefined ? 0 : feedbackDelta(kind, current);
    if (topicId && current !== undefined) updates.set(topicId, current + delta);
    must(await db.from('feedback').insert({ user_id: profile.id, cluster_id: clusterId, kind, topic_id: topicId, delta }), 'feedback insert');
  }
  for (const [topicId, weight] of updates) {
    must(await db.from('user_topics').update({ weight }).eq('user_id', profile.id).eq('topic_id', topicId), 'user_topics weight');
  }
}

export async function markRead(profile: Profile, clusterId: number, { read, listened }: { read?: boolean; listened?: boolean }) {
  const now = new Date().toISOString();
  const cur = must(
    await db.from('reads').select('read_at,listened_at').eq('user_id', profile.id).eq('cluster_id', clusterId).maybeSingle(),
    'reads',
  ) as { read_at: string | null; listened_at: string | null } | null;
  must(
    await db.from('reads').upsert(
      {
        user_id: profile.id,
        cluster_id: clusterId,
        read_at: cur?.read_at ?? (read ? now : null),
        listened_at: cur?.listened_at ?? (listened ? now : null),
      },
      { onConflict: 'user_id,cluster_id' },
    ),
    'reads upsert',
  );
}
