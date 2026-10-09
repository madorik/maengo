import 'server-only';
import { modelFor, tierOf } from '@maengo/core/ai';
import { CATEGORIES, type CategoryId } from '@maengo/core/categories';
import { excludesCluster, feedbackDelta, rankFeed, WEIGHT_MAX, WEIGHT_MIN } from '@maengo/core/feed';
import { kstDate, kstDayLabel, kstGreetingDate, notifyTimeLabel, publishedLabel } from '@maengo/core/kst';
import { JOB_INFO, TOPIC_BY_ID } from '@maengo/core/topics';
import { youtubeId, youtubeThumbnail } from '@maengo/core/youtube';
import type { FeedbackKind, Tier } from '@maengo/core/types';
import type { FeedItem, LibraryData, LibraryEntry, ProfileView, TodayData } from '../types';
import { ai } from './ai';
import { CLUSTER_BY_ID, DEMO_CLUSTERS, toCandidate, type DemoCluster } from './demo-clusters';
import {
  entitlements, feedbackOf, readsOf, store, trialDaysLeft, weightsOf,
  type FeedRecord, type FeedRow, type Profile,
} from './store';

/** 랭킹은 늘 최대치(10개)까지 해 두고, 보여 줄 개수만 플랜으로 정한다. why 문구는 보여 주는 것만 만든다. */
const MAX_DAILY = 10;

const feedKey = (userId: string, date: string) => `${userId}|${date}`;

/** buildFeedForUser(PLAN.md 5.4). 이미 읽거나 들은 소식, 이미 알아요·관심 없어요를 누른 소식은 뺀다. */
function buildRows(userId: string): FeedRow[] {
  const exclude = new Set<number>();
  for (const [id, r] of readsOf(userId)) if (r.readAt || r.listenedAt) exclude.add(id);
  for (const [id, f] of feedbackOf(userId)) if (excludesCluster(f.kind)) exclude.add(id);
  return rankFeed(DEMO_CLUSTERS.map(toCandidate), weightsOf(userId), exclude, { limit: MAX_DAILY }).map((r, i) => ({
    rank: i + 1,
    clusterId: r.clusterId,
    topicId: r.topicId,
  }));
}

/** 오늘 피드. 보여 주는 개수는 지금 플랜을 따른다(체험을 시작하면 바로 10개로 늘어난다). */
function todayRecord(profile: Profile): FeedRecord {
  const key = feedKey(profile.id, kstDate());
  let rec = store.feeds.get(key);
  if (!rec) store.feeds.set(key, (rec = { rows: buildRows(profile.id), visible: 0 }));
  rec.visible = Math.min(rec.rows.length, entitlements(profile).dailyItems);
  return rec;
}

function recordOn(profile: Profile, date: string): FeedRecord | undefined {
  return date === kstDate() ? todayRecord(profile) : store.feeds.get(feedKey(profile.id, date));
}

function visibleRows(rec: FeedRecord | undefined): FeedRow[] {
  return rec ? rec.rows.slice(0, rec.visible) : [];
}

export function todayRows(profile: Profile): FeedRow[] {
  return visibleRows(todayRecord(profile));
}

export function rebuildFeed(profile: Profile) {
  store.feeds.delete(feedKey(profile.id, kstDate()));
  todayRecord(profile);
}

/** 이 유저가 받은 피드 날짜(최신순) */
function feedDates(profile: Profile): string[] {
  todayRecord(profile);
  const prefix = `${profile.id}|`;
  return [...store.feeds.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort().reverse();
}

/** 받은 피드 어디에서든 이 소식을 찾는다(보여 준 것만) */
function findRow(profile: Profile, clusterId: number): { row: FeedRow; date: string } | null {
  for (const date of feedDates(profile)) {
    const row = visibleRows(recordOn(profile, date)).find((r) => r.clusterId === clusterId);
    if (row) return { row, date };
  }
  return null;
}

export function isInUserFeed(profile: Profile, clusterId: number): boolean {
  return findRow(profile, clusterId) !== null;
}

/** cluster_why 캐시를 먼저 보고, 없을 때만 AI를 부른다. 등급마다 모델이 달라 캐시도 따로 둔다. */
async function resolveWhy(c: DemoCluster, topicId: string, profile: Profile, tier: Tier): Promise<string> {
  const key = `${c.id}|${topicId}|${profile.job}|${tier}`;
  const hit = store.why.get(key);
  if (hit) return hit.text;
  const model = modelFor(tier);
  const text = await ai.why({
    model,
    clusterId: c.id,
    title: c.title,
    short: c.short,
    body: c.body,
    topicId,
    topicName: TOPIC_BY_ID.get(topicId)?.name ?? topicId,
    jobLead: JOB_INFO[profile.job].whyLead,
  });
  store.why.set(key, { text, model });
  return text;
}

/** 카테고리는 클러스터마다 한 번만 분류한다. 모두가 같이 쓰는 값이라 싼 모델(basic)을 쓴다. */
async function resolveCategory(c: DemoCluster): Promise<CategoryId> {
  const hit = store.categories.get(c.id);
  if (hit) return hit;
  const category = await ai.classify({ model: modelFor('basic'), title: c.title, short: c.short, body: c.body });
  store.categories.set(c.id, category);
  return category;
}

const publishedOf = (c: DemoCluster, now: Date) => publishedLabel(new Date(now.getTime() - c.ageHours * 3600_000).toISOString(), now);

async function toItem(profile: Profile, row: FeedRow, date: string, now: Date): Promise<FeedItem> {
  const c = CLUSTER_BY_ID.get(row.clusterId)!;
  const videoId = c.kind === 'video' ? youtubeId(c.url) : null;
  return {
    rank: row.rank,
    clusterId: c.id,
    feedDate: date,
    title: c.title,
    kind: c.kind,
    category: await resolveCategory(c),
    sourceLabel: c.sourceLabel,
    author: c.author,
    publishedLabel: publishedOf(c, now),
    coverage: c.coverage,
    url: c.url,
    thumbnail: videoId ? youtubeThumbnail(videoId) : null,
    short: c.short,
    body: c.body,
    scenes: c.scenes,
    topicId: row.topicId,
    topicName: TOPIC_BY_ID.get(row.topicId)?.name ?? row.topicId,
    why: await resolveWhy(c, row.topicId, profile, tierOf(profile.plan)),
  };
}

export async function feedItems(profile: Profile, date = kstDate()): Promise<FeedItem[]> {
  const now = new Date();
  return Promise.all(visibleRows(recordOn(profile, date)).map((row) => toItem(profile, row, date, now)));
}

/** 상세 화면용. 오늘 것이 아니어도 받은 적 있는 소식이면 연다 */
export async function findFeedItem(profile: Profile, clusterId: number): Promise<{ item: FeedItem; isToday: boolean } | null> {
  const found = findRow(profile, clusterId);
  if (!found) return null;
  return { item: await toItem(profile, found.row, found.date, new Date()), isToday: found.date === kstDate() };
}

/** 전체 글까지 다 읽는 시간. 한국어 읽기 속도를 분당 400자로 어림한다. */
function readMinutes(items: FeedItem[]): number {
  const chars = items.reduce((n, i) => n + i.body.join('').length + i.why.length, 0);
  return Math.max(1, Math.round(chars / 400));
}

export async function getTodayData(profile: Profile): Promise<TodayData> {
  const date = kstDate();
  const rec = todayRecord(profile);
  const items = await feedItems(profile, date);
  const reads = readsOf(profile.id);
  const topicNames = [...new Set(items.map((i) => i.topicName))].slice(0, 3);
  const feedback: Record<number, FeedbackKind> = {};
  for (const [id, f] of feedbackOf(profile.id)) feedback[id] = f.kind;
  return {
    date,
    signature: `${date}:${items.map((i) => i.clusterId).join(',')}`,
    greetingDate: kstGreetingDate(),
    jobLabel: JOB_INFO[profile.job].label,
    topicNames,
    readMinutes: readMinutes(items),
    notifyLabel: notifyTimeLabel(profile.notifyAt),
    dailyLimit: entitlements(profile).dailyItems,
    hiddenCount: rec.rows.length - rec.visible,
    items,
    read: [...reads].filter(([, r]) => r.readAt).map(([id]) => id),
    listened: [...reads].filter(([, r]) => r.listenedAt).map(([id]) => id),
    feedback,
  };
}

export const LIBRARY_PAGE_SIZE = 10;

/** 보관함: 지금까지 받은 피드 전체(최신순)를 카테고리로 거르고 페이지로 나눈다 */
export async function getLibrary(profile: Profile, { page, category }: { page: number; category: CategoryId | null }): Promise<LibraryData> {
  const now = new Date();
  const reads = readsOf(profile.id);
  const all: LibraryEntry[] = [];
  for (const date of feedDates(profile)) {
    for (const row of visibleRows(recordOn(profile, date))) {
      const c = CLUSTER_BY_ID.get(row.clusterId)!;
      all.push({
        clusterId: c.id,
        feedDate: date,
        title: c.title,
        short: c.short,
        kind: c.kind,
        category: await resolveCategory(c),
        sourceLabel: c.sourceLabel,
        author: c.author,
        publishedLabel: publishedOf(c, now),
        read: !!reads.get(c.id)?.readAt,
        listened: !!reads.get(c.id)?.listenedAt,
      });
    }
  }

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
export function setFeedback(profile: Profile, clusterId: number, kind: FeedbackKind | null) {
  const map = feedbackOf(profile.id);
  const weights = weightsOf(profile.id);
  const clamp = (w: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w));
  const prev = map.get(clusterId);
  if (prev) {
    weights[prev.topicId] = clamp((weights[prev.topicId] ?? 0) - prev.delta);
    map.delete(clusterId);
  }
  if (!kind) return;
  const topicId = findRow(profile, clusterId)?.row.topicId ?? CLUSTER_BY_ID.get(clusterId)!.topics[0]!.topicId;
  const current = weights[topicId] ?? 0;
  const delta = feedbackDelta(kind, current);
  weights[topicId] = current + delta;
  map.set(clusterId, { kind, topicId, delta });
}

export function markRead(profile: Profile, clusterId: number, { read, listened }: { read?: boolean; listened?: boolean }) {
  const reads = readsOf(profile.id);
  const row = reads.get(clusterId) ?? {};
  if (read) row.readAt ??= Date.now();
  if (listened) row.listenedAt ??= Date.now();
  reads.set(clusterId, row);
}
