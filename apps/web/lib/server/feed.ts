import 'server-only';
import { cache } from 'react';
import { CATEGORIES, isCategory, type CategoryId } from '@maengo/core/categories';
import { excludesCluster, feedbackDelta, linkCap, popularityBoost, rankFeed, WEIGHT_MAX, WEIGHT_MIN, type RankCandidate } from '@maengo/core/feed';
import { assembleClusterInfo, partsOfEmbedded, TIERS, type ClusterInfo, type EmbeddedCluster, type ItemRow, type RepRow, type SummaryRow, type WhyRow } from '../cluster-info';
import { libraryTerms } from '../library-search';
import { beforeNotify, kstDate, kstDayLabel, kstGreetingDate, notifyTimeLabel, publishedLabel } from '@maengo/core/kst';
import { daysBefore } from '@maengo/core/plans';
import { isLinkTopicId, rankingWeights, whyLead } from '@maengo/core/topics';
import { youtubeId, youtubeThumbnail } from '@maengo/core/youtube';
import type { FeedbackKind } from '@maengo/core/types';
import type { FeedItem, LibraryData, LibraryEntry, LibraryReadFilter, ProfileView, TodayData } from '../types';
import { ai } from './ai';
import { isAdmin } from './admin';
import { db, must } from './db';
import { instantBuilding } from './instant-lock';
import { entitlements, type Profile } from './profile';
import { topicNames } from './topics';
import { recentSignupGift, refundMaengo, spendMaengo, syncWallet } from './wallet';

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
  /** 맹고를 써서 더 받은 개수 */
  extra: number;
  /** 피드 줄과 같이 읽어 둔 소식 내용(readDay withInfo). 없으면 itemsFor가 따로 읽는다 */
  info?: Map<number, ClusterInfo>;
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

/** 소식을 고를 때의 가중치: 내 관심 링크는 지금 플랜 개수까지만(Free 0개, 칸 번호 순. 파이프라인 audience.ts와 같은 규칙) */
async function rankWeightsOf(profile: Profile): Promise<Record<string, number>> {
  const rows = must(await db.from('user_topics').select('topic_id,weight,slot').eq('user_id', profile.id), 'user_topics') as { topic_id: string; weight: number; slot: number | null }[];
  return rankingWeights(rows, entitlements(profile).linkLimit);
}

/** 지난 days일(기본 7일) 안에 요약이 끝난 소식 */
async function summarizedCandidates(days = 7): Promise<RankCandidate[]> {
  const since = new Date(Date.now() - days * 24 * HOUR).toISOString();
  const rows = must(
    await db
      .from('summaries')
      .select('cluster_id, title, clusters!inner(first_seen_at,size,is_video,skip_reason,rep:items!clusters_rep_item_id_fkey(views,hn_points,published_at,sources(weight,lang)))')
      .eq('tier', 'basic')
      .gte('clusters.first_seen_at', since)
      .is('clusters.skip_reason', null),
    'candidates',
  ) as unknown as {
    cluster_id: number;
    title: string;
    clusters: {
      first_seen_at: string;
      size: number;
      is_video: boolean;
      rep: { views: number | null; hn_points: number | null; published_at: string | null; sources: { weight: number; lang: string } | null } | null;
    };
  }[];
  if (!rows.length) return [];
  const topics = must(
    await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', rows.map((r) => r.cluster_id)),
    'cluster_topics',
  ) as { cluster_id: number; topic_id: string; relevance: number }[];
  const byCluster = new Map<number, { topicId: string; relevance: number }[]>();
  for (const t of topics) (byCluster.get(t.cluster_id) ?? byCluster.set(t.cluster_id, []).get(t.cluster_id)!).push({ topicId: t.topic_id, relevance: t.relevance });
  const now = new Date();
  return rows
    .filter((r) => byCluster.has(r.cluster_id))
    .map((r) => {
      const rep = r.clusters.rep;
      return {
        id: r.cluster_id,
        ageHours: (now.getTime() - Date.parse(r.clusters.first_seen_at)) / HOUR,
        sourceWeight: rep?.sources?.weight ?? 1,
        lang: rep?.sources?.lang,
        popularity: rep ? popularityBoost({ sourceWeight: 1, views: rep.views, hnPoints: rep.hn_points, publishedAt: rep.published_at }, now) : 1,
        size: r.clusters.size,
        isVideo: r.clusters.is_video,
        topics: byCluster.get(r.cluster_id)!,
        title: r.title,
      };
    });
}

async function buildToday(profile: Profile, date: string): Promise<FeedRow[]> {
  const [candidates, weights, exclude] = await Promise.all([summarizedCandidates(), rankWeightsOf(profile), exclusions(profile.id, date)]);
  // 내 관심 링크 글은 하루 소식의 절반까지(D19)
  const ranked = rankFeed(candidates, weights, exclude, { limit: MAX_DAILY, visible: entitlements(profile).dailyItems, maxLinks: linkCap(entitlements(profile).dailyItems), day: date }).map((r, i) => ({ rank: i + 1, clusterId: r.clusterId, topicId: r.topicId }));
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

/** 피드 줄 그대로(feeds 표) */
const FEED_COLS = 'rank,cluster_id,topic_id';
/**
 * 피드 줄에 소식 내용(요약·why·묶인 글)을 같이 받는다(PostgREST embed). 전엔 피드를 읽고 나서 소식 내용을 또 읽어 DB를 두 번 오갔다(2026-10-19).
 * clusters↔items는 외래 키가 둘(items.cluster_id, clusters.rep_item_id)이라 어느 쪽인지 적어 준다
 */
const FEED_WITH_INFO = `${FEED_COLS},clusters!inner(rep_item_id,summaries(cluster_id,tier,title,short,body,category,author,published_at,scenes),cluster_why(cluster_id,topic_id,tier,why),items!items_cluster_id_fkey(id,cluster_id,canonical_url,kind,author,sources(name)))`;

interface FeedRowRaw {
  rank: number;
  cluster_id: number;
  topic_id: string;
  clusters?: EmbeddedCluster | null;
}

/** 그날 피드. withInfo면 소식 내용까지 한 번에 읽어 info에 둔다 */
async function readDay(userId: string, date: string, { withInfo = false } = {}): Promise<FeedDay | null> {
  let feedQuery = db.from('feeds').select(withInfo ? FEED_WITH_INFO : FEED_COLS).eq('user_id', userId).eq('date', date);
  if (withInfo) feedQuery = feedQuery.in('clusters.summaries.tier', TIERS).in('clusters.cluster_why.tier', TIERS);
  const [day, feeds] = await Promise.all([
    db.from('feed_days').select('visible,extra').eq('user_id', userId).eq('date', date).maybeSingle(),
    feedQuery.order('rank'),
  ]);
  const d = must(day, 'feed_days') as { visible: number; extra: number } | null;
  if (!d) return null;
  const raw = must(feeds, 'feeds') as unknown as FeedRowRaw[];
  const rows = raw.map((r) => ({ rank: r.rank, clusterId: r.cluster_id, topicId: r.topic_id }));
  const info = withInfo ? assembleClusterInfo(rows.map((r) => r.clusterId), partsOfEmbedded(raw)) : undefined;
  return { date, rows, visible: d.visible, extra: d.extra, info };
}

/** 전에 받은 피드가 있는지. 가입하고 아직 한 번도 받지 않았으면 false */
const hadFeedBefore = cache(async (userId: string, date: string): Promise<boolean> => {
  const { count, error } = await db.from('feed_days').select('date', { count: 'exact', head: true }).eq('user_id', userId).lt('date', date);
  if (error) throw new Error(`feed_days: ${error.message}`);
  return (count ?? 0) > 0;
});

/**
 * 오늘 보여 줄 개수: 지금 플랜 기본 + 맹고로 더 받은 개수(체험을 시작하면 바로 늘어난다). 이미 보여 준 개수보다 줄이지는 않는다:
 * 체험·Premium이 낮에 끝나 플랜이 내려가도 받은 소식이 사라지지 않고(글이 안 열리거나 '하나 더 받기'가 그 소식을 다시 맹고로 받게 하지 않게) 다음 날부터 줄어든다
 */
const shownCount = (day: FeedDay, limit: number) => Math.max(day.visible, Math.min(day.rows.length, limit + day.extra));

/** 오늘 피드. 보여 주는 개수는 shownCount */
const todayFeed = cache(async (profile: Profile): Promise<FeedDay> => {
  const date = kstDate();
  const limit = entitlements(profile).dailyItems;
  let day = await readDay(profile.id, date, { withInfo: true });
  // 오늘 피드가 하루 맹고(+ 더 받은 것)보다 적으면(AI가 막혔던 때 만든 피드 등) 이미 요약된 소식으로 모자란 만큼 채운다
  if (day && day.rows.length < limit + day.extra) day = await topUp(profile, day, limit + day.extra - day.rows.length);
  if (day) {
    const visible = shownCount(day, limit);
    if (visible !== day.visible) must(await db.from('feed_days').update({ visible }).eq('user_id', profile.id).eq('date', date), 'feed_days visible');
    return { ...day, visible };
  }
  // 가입하고 처음 온 사람은 저절로 채우지 않는다. '오늘 맹고 받기'를 눌러야 가져오거나 만든다(진행 상황을 보여 주려고)
  if (!(await hadFeedBefore(profile.id, date))) return { date, rows: [], visible: 0, extra: 0 };
  // 하루 소식은 알림 시각에 지급한다(1분마다 도는 배송이 그때 골라 요약해 만든다). 그 전과 알림 뒤 10분은 배송을 기다린다
  if (beforeNotify(profile.notifyAt, new Date(), DELIVERY_GRACE_MS)) return { date, rows: [], visible: 0, extra: 0 };
  // 알림 시각이 한참 지났는데 오늘 피드가 없다(배송이 못 만든 날). 이미 요약된 소식으로 만든다. 배송은 있는 피드를 건너뛴다
  const rows = await buildToday(profile, date);
  const visible = Math.min(rows.length, limit);
  if (rows.length) {
    must(
      await db.from('feed_days').upsert({ user_id: profile.id, date, visible, built_by: 'web' }, { onConflict: 'user_id,date', ignoreDuplicates: true }),
      'feed_days insert',
    );
  }
  return { date, rows, visible, extra: 0 };
});

/**
 * 오늘 피드를 need개까지 채운다: 최근 한 달 안에 요약이 끝났지만 준 적 없는 소식만(지난 피드·읽음·싫어요·오늘 것 빼고).
 * AI는 부르지 않는다. 같은 자리에 두 번 들어가면 뒤의 것은 무시된다(순번 충돌).
 */
async function topUp(profile: Profile, day: FeedDay, need: number): Promise<FeedDay> {
  const [candidates, weights, exclude] = await Promise.all([summarizedCandidates(MORE_DAYS), rankWeightsOf(profile), exclusions(profile.id, day.date)]);
  for (const r of day.rows) exclude.add(r.clusterId);
  const picked = rankFeed(candidates, weights, exclude, { limit: need });
  if (!picked.length) return day;
  let rank = day.rows.at(-1)?.rank ?? 0;
  const rows = picked.map((p) => ({ rank: ++rank, clusterId: p.clusterId, topicId: p.topicId }));
  const { error } = await db
    .from('feeds')
    .upsert(rows.map((r) => ({ user_id: profile.id, date: day.date, rank: r.rank, cluster_id: r.clusterId, topic_id: r.topicId })), { onConflict: 'user_id,date,rank', ignoreDuplicates: true });
  if (error) {
    console.error('feeds top-up', error.message);
    return day;
  }
  return (await readDay(profile.id, day.date, { withInfo: true })) ?? day;
}

export type MoreResult = { ok: true; charged: boolean } | { ok: false; error: 'no_feed' | 'no_more' | 'no_balance' | 'busy' | 'blocked' };

/** '하나 더 받기'가 찾아보는 기간: 최근 한 달 */
const MORE_DAYS = 30;

/**
 * 오늘 맹고 하나 더 받기. 준 적 없는 소식만, 이 순서로 찾는다(2026-10-14 사용자 결정):
 *   1. 오늘 골라 두고 안 보여 준 소식(Free는 10개를 골라 3개만 보여 준다)
 *   2. 최근 한 달 안에 요약이 끝났지만 이 사람에게 준 적 없는 소식
 *   3. 그래도 없으면 최근 한 달 안에 모아 둔 묶음을 지금 요약해서(pipeline makeOneMore, AI를 부른다)
 * 하루 맹고(플랜의 하루 소식 수)를 다 채웠으면 지갑에서 1맹고를 쓴다(못 붙이면 돌려준다). 잔액은 AI를 부르기 전에 본다.
 */
export async function receiveMore(profile: Profile): Promise<MoreResult> {
  const date = kstDate();
  const day = await readDay(profile.id, date);
  if (!day || !day.rows.length) return { ok: false, error: 'no_feed' };
  const limit = entitlements(profile).dailyItems;
  const visible = shownCount(day, limit);
  const charged = visible >= limit;
  // 지갑에서 써야 하는데 모자라면 찾기·요약 전에 멈춘다
  if (charged && (await syncWallet(profile.id)) < 1) return { ok: false, error: 'no_balance' };

  let row = day.rows[visible];
  const fresh = !row;
  if (fresh) {
    const [candidates, weights, exclude] = await Promise.all([summarizedCandidates(MORE_DAYS), rankWeightsOf(profile), exclusions(profile.id, date)]);
    for (const r of day.rows) exclude.add(r.clusterId);
    const [next] = rankFeed(candidates, weights, exclude, { limit: 1 });
    let pick = next ? { clusterId: next.clusterId, topicId: next.topicId } : null;
    if (!pick) {
      // 요약된 게 다 떨어졌다: 한 달 안의 묶음을 지금 요약한다(파이프라인은 무거워서 여기서만 불러온다)
      const { makeOneMore } = await import('@maengo/pipeline/instant');
      const made = await makeOneMore(profile.id, [...exclude]);
      if (made === 'blocked') return { ok: false, error: 'blocked' };
      if (made === 'none') return { ok: false, error: 'no_more' };
      pick = made;
    }
    row = { rank: (day.rows.at(-1)?.rank ?? 0) + 1, ...pick };
  }

  // 같은 자리를 두 번 누르면 하나만 붙는다(feed_days.extra 조건). 진 쪽은 돌려받는다
  const ref = `${date}:${day.extra + 1}:${crypto.randomUUID().slice(0, 8)}`;
  if (charged && !(await spendMaengo(profile.id, 1, ref))) return { ok: false, error: 'no_balance' };
  const undo = async () => {
    if (charged) await refundMaengo(profile.id, ref);
  };
  try {
    if (fresh) {
      const { error } = await db.from('feeds').insert({ user_id: profile.id, date, rank: row!.rank, cluster_id: row!.clusterId, topic_id: row!.topicId });
      if (error) {
        await undo();
        return { ok: false, error: 'busy' };
      }
    }
    const extra = day.extra + (charged ? 1 : 0);
    const updated = must(
      await db.from('feed_days').update({ extra, visible: visible + 1 }).eq('user_id', profile.id).eq('date', date).eq('extra', day.extra).select('date'),
      'feed_days more',
    ) as { date: string }[];
    if (!updated.length) {
      if (fresh) await db.from('feeds').delete().eq('user_id', profile.id).eq('date', date).eq('rank', row!.rank);
      await undo();
      return { ok: false, error: 'busy' };
    }
  } catch (e) {
    await undo();
    throw e;
  }
  return { ok: true, charged };
}

const visibleRows = (day: FeedDay | null) => (day ? day.rows.slice(0, day.visible) : []);

/**
 * '오늘 소식 받기'(api/feed/today)가 다시 만들어도 되는지 본다. 오늘 화면과 같은 기준(todayFeed의 보여 줄 칸 중 요약이 남은 소식)으로
 * 보일 소식이 있으면 막는다. 줄은 있어도 묶음이 합쳐지거나 지워져 보일 게 없으면 오늘 화면이 비어 '오늘 소식 받기'가 보이므로 그때는 다시 만든다.
 * extra는 맹고로 더 받은 개수(다시 만들어도 지킨다, restoreTodayExtra)
 */
export async function todayForRebuild(profile: Profile): Promise<{ date: string; hasItems: boolean; extra: number }> {
  const day = await todayFeed(profile);
  const rows = visibleRows(day);
  const info = rows.length ? (day.info ?? (await clusterInfo(rows.map((r) => r.clusterId)))) : new Map<number, ClusterInfo>();
  const hasItems = rows.some((r) => info.has(r.clusterId));
  return { date: day.date, hasItems, extra: day.extra };
}

/**
 * 다시 만들기가 소식 없이 끝났거나 실패해 그날 행(feed_days)이 지워졌으면, 맹고로 더 받은 개수(extra)만 든 빈 행을 되살린다.
 * 행이 있으면(잘 만들어졌으면) 그대로 둔다. 빈 행이면 오늘 화면을 열 때 요약된 소식으로 하루 맹고 + extra만큼 채워 본다(todayFeed → topUp)
 */
export async function restoreTodayExtra(userId: string, date: string, extra: number): Promise<void> {
  if (extra <= 0) return;
  try {
    const { error } = await db
      .from('feed_days')
      .upsert({ user_id: userId, date, visible: 0, extra, built_by: 'web' }, { onConflict: 'user_id,date', ignoreDuplicates: true });
    if (error) console.error('[instant] 더 받은 개수 되살리기 실패', error.message);
  } catch (e) {
    console.error('[instant] 더 받은 개수 되살리기 실패', String((e as Error)?.message ?? e));
  }
}

export async function rebuildFeed(profile: Profile) {
  const date = kstDate();
  must(await db.from('feeds').delete().eq('user_id', profile.id).eq('date', date), 'feeds delete');
  must(await db.from('feed_days').delete().eq('user_id', profile.id).eq('date', date), 'feed_days delete');
}

/**
 * 하루 맹고(설정 > 플랜): 오늘 하루 맹고에서 지급한 수 / 플랜의 하루 맹고. 맹고 = 소식(2026-10-14 사용자 정책).
 * Free 3개 중 2개를 받았으면 2/3. 지갑으로 더 받은 건 세지 않는다. 오늘 피드가 아직 없으면 0/3
 */
export async function dailyMaengoUsage(profile: Profile): Promise<{ given: number; daily: number }> {
  const daily = entitlements(profile).dailyItems;
  const day = await todayFeed(profile);
  return { given: Math.min(day.visible, daily), daily };
}

/**
 * '남은 소식 더 받기'(api/feed/today/fill)가 보는 오늘 상태: 오늘 피드가 있는지, 보여 주는 개수, 오늘 받을 수 있는 수(하루 소식 + 맹고로 더 받은 수).
 * todayFeed가 이미 요약된 소식으로 먼저 채운 뒤의 값이라, 여기서 모자란 만큼은 AI로 새로 만들어야 한다
 */
export async function todayFillStatus(profile: Profile): Promise<{ hasFeed: boolean; visible: number; want: number }> {
  const day = await todayFeed(profile);
  return { hasFeed: day.rows.length > 0, visible: day.visible, want: entitlements(profile).dailyItems + day.extra };
}

/** 보관함에서 볼 수 있는 가장 오래된 날(plans 표 archive_days, Free는 최근 90일). null이면 전부 */
function archiveFrom(profile: Profile, today: string): string | null {
  const days = entitlements(profile).archiveDays;
  return days === null ? null : daysBefore(today, days - 1);
}

/** 오늘을 뺀 지난 피드(최신순). 플랜이 보여 주는 기간만. today는 오늘 날짜(todayFeed와 같은 kstDate())라서 오늘 피드와 나란히 읽을 수 있다 */
async function pastDays(profile: Profile, today: string): Promise<FeedDay[]> {
  const from = archiveFrom(profile, today);
  let dayQuery = db.from('feed_days').select('date,visible,extra').eq('user_id', profile.id).neq('date', today);
  let feedQuery = db.from('feeds').select(`date,${FEED_COLS}`).eq('user_id', profile.id).neq('date', today);
  if (from) {
    dayQuery = dayQuery.gte('date', from);
    feedQuery = feedQuery.gte('date', from);
  }
  const [days, feeds] = await Promise.all([dayQuery.order('date', { ascending: false }), feedQuery.order('rank')]);
  const rowsByDate = new Map<string, FeedRow[]>();
  for (const r of must(feeds, 'feeds') as { date: string; rank: number; cluster_id: number; topic_id: string }[]) {
    (rowsByDate.get(r.date) ?? rowsByDate.set(r.date, []).get(r.date)!).push({ rank: r.rank, clusterId: r.cluster_id, topicId: r.topic_id });
  }
  return (must(days, 'feed_days') as { date: string; visible: number; extra: number }[]).map((d) => ({ date: d.date, visible: d.visible, extra: d.extra, rows: rowsByDate.get(d.date) ?? [] }));
}

/** 받은 피드 전체(최신순). 오늘 것은 지금 플랜 기준, 지난 날은 플랜이 보여 주는 기간만. 오늘과 지난 피드를 나란히 읽는다(플레이리스트용. 보관함 화면은 getLibrary) */
async function allDays(profile: Profile): Promise<FeedDay[]> {
  const [today, past] = await Promise.all([todayFeed(profile), pastDays(profile, kstDate())]);
  return [today, ...past];
}

/** 받은 피드 어디에서든 이 소식을 찾는다(보여 준 것만, 플랜이 보여 주는 기간만). 오늘 것이면 같이 읽어 둔 소식 내용(info)도 준다 */
async function findRow(profile: Profile, clusterId: number): Promise<{ row: FeedRow; date: string; info?: Map<number, ClusterInfo> } | null> {
  const today = await todayFeed(profile);
  const hitToday = visibleRows(today).find((r) => r.clusterId === clusterId);
  if (hitToday) return { row: hitToday, date: today.date, info: today.info };
  const from = archiveFrom(profile, today.date);
  let query = db.from('feeds').select('date,rank,topic_id').eq('user_id', profile.id).eq('cluster_id', clusterId).neq('date', today.date);
  if (from) query = query.gte('date', from);
  const rows = must(await query.order('date', { ascending: false }), 'feeds') as { date: string; rank: number; topic_id: string }[];
  if (!rows.length) return null;
  // 보관함처럼 '그날 앞에서부터 visible개'로 본다(순번은 중복 합치기·채우기로 비는 칸이 있어 순번 숫자로 비교하면 안 된다).
  // 들어 있는 날들의 visible과 줄을 한 번에 읽는다(전엔 날마다 두 번씩 오갔다)
  const dates = rows.map((r) => r.date);
  const [days, shown] = await Promise.all([
    db.from('feed_days').select('date,visible').eq('user_id', profile.id).in('date', dates),
    db.from('feeds').select('date,cluster_id').eq('user_id', profile.id).in('date', dates).order('rank'),
  ]);
  const visibleOf = new Map((must(days, 'feed_days') as { date: string; visible: number }[]).map((d) => [d.date, d.visible]));
  const shownByDate = new Map<string, number[]>();
  for (const r of must(shown, 'feeds day') as { date: string; cluster_id: number }[]) (shownByDate.get(r.date) ?? shownByDate.set(r.date, []).get(r.date)!).push(r.cluster_id);
  for (const r of rows) {
    const visible = visibleOf.get(r.date);
    if (visible === undefined) continue;
    if ((shownByDate.get(r.date) ?? []).slice(0, visible).includes(clusterId)) return { row: { rank: r.rank, clusterId, topicId: r.topic_id }, date: r.date };
  }
  return null;
}

export async function isInUserFeed(profile: Profile, clusterId: number): Promise<boolean> {
  return (await findRow(profile, clusterId)) !== null;
}

// ---- 소식 내용 ----

/** 소식 여러 개를 한 번에 읽는다(네 표를 나란히). 피드 줄과 같이 받은 것(readDay withInfo)이 없을 때만 쓴다. 조립은 lib/cluster-info.ts */
async function clusterInfo(ids: number[]): Promise<Map<number, ClusterInfo>> {
  if (!ids.length) return new Map();
  const [summaries, whys, clusters, items] = await Promise.all([
    db.from('summaries').select('cluster_id,tier,title,short,body,category,author,published_at,scenes').in('cluster_id', ids).in('tier', TIERS),
    db.from('cluster_why').select('cluster_id,topic_id,tier,why').in('cluster_id', ids).in('tier', TIERS),
    db.from('clusters').select('id,rep_item_id').in('id', ids),
    db.from('items').select('id,cluster_id,canonical_url,kind,author,sources(name)').in('cluster_id', ids),
  ]);
  return assembleClusterInfo(ids, {
    summaries: must(summaries, 'summaries') as SummaryRow[],
    whys: must(whys, 'cluster_why') as WhyRow[],
    reps: must(clusters, 'clusters') as RepRow[],
    items: must(items, 'items') as unknown as ItemRow[],
  });
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
    // why는 파이프라인이 토픽마다 만들어 둔다. 없으면 요약으로 대신한다(웹에서 LLM을 부르지 않으려고). 내 관심 링크 글은 AI 없이 고정 문구
    why: isLinkTopicId(row.topicId) ? `내 관심 링크 ${topicName}의 새 글: ${c.short}` : c.why.get(row.topicId) ?? `${whyLead(topicName)}: ${c.short}`,
  };
}

/** rows의 소식을 FeedItem으로. known은 피드 줄과 같이 읽어 둔 소식 내용(readDay withInfo). 있으면 DB를 다시 오가지 않는다 */
async function itemsFor(profile: Profile, rows: FeedRow[], date: string, known?: Map<number, ClusterInfo>): Promise<FeedItem[]> {
  // 직접 입력한 관심사(사전에 없는 토픽)의 이름은 DB에서 찾는다
  const [info, names] = await Promise.all([known ?? clusterInfo(rows.map((r) => r.clusterId)), topicNames(rows.map((r) => r.topicId))]);
  const now = new Date();
  return rows.flatMap((r) => {
    const c = info.get(r.clusterId);
    return c ? [toItem(r, date, c, now, names)] : [];
  });
}

/** 보관함 플레이리스트: 받은 피드(보여 준 것)에 있는 소식만, 고른 순서대로 */
export async function playlistItems(profile: Profile, ids: number[]): Promise<FeedItem[]> {
  const want = new Set(ids);
  const byDate = new Map<string, FeedRow[]>();
  const seen = new Set<number>();
  for (const day of await allDays(profile)) {
    for (const row of visibleRows(day)) {
      if (!want.has(row.clusterId) || seen.has(row.clusterId)) continue;
      seen.add(row.clusterId);
      (byDate.get(day.date) ?? byDate.set(day.date, []).get(day.date)!).push(row);
    }
  }
  const items = (await Promise.all([...byDate].map(([date, rows]) => itemsFor(profile, rows, date)))).flat();
  const byId = new Map(items.map((i) => [i.clusterId, i]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function feedItems(profile: Profile, date = kstDate()): Promise<FeedItem[]> {
  const day = date === kstDate() ? await todayFeed(profile) : await readDay(profile.id, date, { withInfo: true });
  return itemsFor(profile, visibleRows(day), date, day?.info);
}

/** 상세 화면용. 오늘 것이 아니어도 받은 적 있는 소식이면 연다 */
export const findFeedItem = cache(async (profile: Profile, clusterId: number): Promise<{ item: FeedItem; isToday: boolean } | null> => {
  const found = await findRow(profile, clusterId);
  if (!found) return null;
  const [item] = await itemsFor(profile, [found.row], found.date, found.info);
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

/** 알림 시각에 배송이 소식을 골라 요약하는 동안 화면이 따로 만들지 않고 기다리는 시간(같은 KST 날짜의 알림 시각부터 센다) */
const DELIVERY_GRACE_MS = 10 * 60_000;

/**
 * '오늘 소식 지금 받기'를 막는 앞쪽 여유. 지금 받기는 최대 5분(maxDuration) 걸리므로 알림 시각에 도는 배송과 같은 피드를 함께 만들지 않게
 * 알림 6분 전부터는 배송을 기다린다
 */
const DELIVERY_LEAD_MS = 6 * 60_000;

/** 알림 시각 전이라 하루 소식이 아직 안 왔는지(배송을 기다리는 구간 전). 이때는 '오늘 소식 지금 받기'로 먼저 받을 수 있다 */
const beforeDelivery = (profile: Profile, now = new Date()) => beforeNotify(profile.notifyAt, now, -DELIVERY_LEAD_MS);

/**
 * 배송이 이 사람 오늘 피드를 만들 때인지(알림 6분 전 ~ 알림 10분 뒤). 그동안은 화면에서 따로 만들지 않고 배송을 기다린다.
 * 전에 받은 적 있는 사람만(처음 받는 사람은 바로 만든다). 그 전(알림 시각 전)에는 지금 받기로 먼저 받을 수 있다(2026-10-18 사용자 결정)
 */
export async function waitingForDelivery(profile: Profile): Promise<boolean> {
  const now = new Date();
  return !beforeDelivery(profile, now) && beforeNotify(profile.notifyAt, now, DELIVERY_GRACE_MS) && (await hadFeedBefore(profile.id, kstDate()));
}

/** 오늘 날짜로 배치가 성공한 적이 있는지(없으면 아직 오늘 소식을 고르기 전) */
async function batchRanToday(date: string): Promise<boolean> {
  const { count } = await db.from('pipeline_runs').select('id', { count: 'exact', head: true }).eq('date', date).eq('ok', true);
  return (count ?? 0) > 0;
}

export async function getTodayData(profile: Profile): Promise<TodayData> {
  const day = await todayFeed(profile);
  // 가입 선물은 지갑을 처음 만들 때 들어가므로 지갑을 읽은 뒤에 본다
  const walletAndGift = syncWallet(profile.id).then(async (w) => [w, await recentSignupGift(profile.id, profile.createdAt)] as const);
  const [items, { reads, feedback }, [wallet, signupGift]] = await Promise.all([itemsFor(profile, visibleRows(day), day.date, day.info), readsAndFeedback(profile.id), walletAndGift]);
  const dailyLimit = entitlements(profile).dailyItems;
  // 비었는데 '오늘 소식 받기'가 돌고 있으면(다른 탭·기기, 만드는 중에 화면을 옮겼다 돌아옴) 받기 버튼 대신 만드는 중으로
  const emptyReason = items.length
    ? null
    : (await instantBuilding(profile.id))
      ? 'building'
      : !(await hadFeedBefore(profile.id, day.date))
        ? 'first'
        : beforeDelivery(profile)
          ? 'scheduled'
          : beforeNotify(profile.notifyAt, new Date(), DELIVERY_GRACE_MS)
            ? 'arriving'
            : (await batchRanToday(day.date))
              ? 'exhausted'
              : 'waiting';
  const topicNames = [...new Set(items.map((i) => i.topicName))].slice(0, 3);
  return {
    date: day.date,
    signature: `${day.date}:${items.map((i) => i.clusterId).join(',')}`,
    greetingDate: kstGreetingDate(),
    topicNames,
    readMinutes: readMinutes(items),
    notifyLabel: notifyTimeLabel(profile.notifyAt),
    dailyLimit,
    moreCost: day.visible >= dailyLimit ? 1 : 0,
    wallet,
    emptyReason,
    signupGift,
    items,
    read: reads.filter((r) => r.read_at).map((r) => r.cluster_id),
    listened: reads.filter((r) => r.listened_at).map((r) => r.cluster_id),
    listenedToday: reads.filter((r) => r.listened_at && kstDate(new Date(r.listened_at)) === kstDate()).map((r) => r.cluster_id),
    feedback: Object.fromEntries(feedback.map((f) => [f.cluster_id, f.kind])),
  };
}

/** 홈 화면 위젯이 보이는 오늘 소식 한 줄 */
export interface WidgetItem {
  id: number;
  title: string;
  category: CategoryId;
  read: boolean;
}

/**
 * 홈 화면 위젯(/api/widget)의 오늘 소식. 읽기만 한다: 오늘 화면(todayFeed)과 달리 모자란 소식을 채우거나 새로 만들지 않는다
 * (위젯은 한 시간마다 불러서 그때마다 피드를 바꾸면 안 된다). 아직 피드가 없으면 빈 목록과 알림 시각을 준다
 */
export async function widgetToday(profile: Profile): Promise<{ date: string; notifyLabel: string; items: WidgetItem[] }> {
  const date = kstDate();
  const notifyLabel = notifyTimeLabel(profile.notifyAt);
  const day = await readDay(profile.id, date, { withInfo: true });
  if (!day) return { date, notifyLabel, items: [] };
  const rows = visibleRows({ ...day, visible: shownCount(day, entitlements(profile).dailyItems) });
  const [items, { reads }] = await Promise.all([itemsFor(profile, rows, date, day.info), readsAndFeedback(profile.id)]);
  const consumed = new Set(reads.filter((r) => r.read_at || r.listened_at).map((r) => r.cluster_id));
  return { date, notifyLabel, items: items.map((i) => ({ id: i.clusterId, title: i.title, category: i.category, read: consumed.has(i.clusterId) })) };
}

export const LIBRARY_PAGE_SIZE = 10;

/** library_page(DB 함수)가 돌려주는 값 */
interface LibraryPageRow {
  total: number;
  matched_total: number;
  category_counts: Record<string, number>;
  in_category: number;
  consumed: number;
  filtered_total: number;
  page: number;
  page_count: number;
  pick_ids: number[];
  entries: {
    date: string;
    rank: number;
    cluster_id: number;
    title: string;
    short: string;
    category: string;
    author: string | null;
    published_at: string | null;
    kind: 'article' | 'video';
    url: string;
    source: string;
    read: boolean;
    listened: boolean;
  }[];
}

/**
 * 보관함: 지금까지 받은 피드 전체(최신순)를 카테고리·읽음·검색어로 거르고 쪽으로 나눈다. 들은 것도 읽음으로 친다.
 * 거르기·개수 세기·쪽 나누기는 DB(library_page, 20261019120000_library_page.sql)가 하고 요청한 쪽만 받는다
 * (2026-10-19 사용자 결정: 전체를 읽어 메모리에서 거르지 않는다)
 */
export async function getLibrary(
  profile: Profile,
  {
    page,
    category,
    read,
    query = null,
    overlap = 0,
  }: {
    page: number;
    category: CategoryId | null;
    read: LibraryReadFilter | null;
    query?: string | null;
    /** 이 쪽 앞의 소식을 이만큼 겹쳐 준다(앱 이어 붙이기: 받는 사이 목록이 줄어도 건너뛰는 소식이 없게, 겹친 건 화면이 거른다) */
    overlap?: number;
  },
): Promise<LibraryData> {
  const now = new Date();
  // 오늘 피드를 먼저 읽는다: 오늘 보여 줄 개수(feed_days.visible)를 거기서 맞춘다(플랜이 바뀌었거나 모자란 걸 채운 뒤)
  const today = await todayFeed(profile);
  const r = must(
    await db.rpc('library_page', {
      p_user: profile.id,
      p_today: today.date,
      p_from: archiveFrom(profile, today.date),
      p_category: category,
      p_unread: read === 'unread',
      p_terms: libraryTerms(query),
      p_page: page,
      p_size: LIBRARY_PAGE_SIZE,
      p_overlap: overlap,
    }),
    'library_page',
  ) as unknown as LibraryPageRow;

  const groups: LibraryData['groups'] = [];
  for (const e of r.entries) {
    const entry: LibraryEntry = {
      clusterId: e.cluster_id,
      feedDate: e.date,
      title: e.title,
      short: e.short,
      kind: e.kind,
      category: isCategory(e.category) ? e.category : 'etc',
      sourceLabel: e.source,
      author: e.author ?? e.source,
      publishedLabel: e.published_at ? publishedLabel(e.published_at, now) : '',
      read: e.read,
      listened: e.listened,
    };
    const last = groups.at(-1);
    if (last?.date === e.date) last.entries.push(entry);
    else groups.push({ date: e.date, label: kstDayLabel(e.date, now), entries: [entry] });
  }

  return {
    total: r.total,
    filteredTotal: r.filtered_total,
    page: r.page,
    pageCount: r.page_count,
    category,
    readFilter: read,
    query,
    matchedTotal: r.matched_total,
    readCounts: { all: r.in_category, unread: r.in_category - r.consumed },
    pickIds: r.pick_ids,
    categories: CATEGORIES.filter((c) => r.category_counts[c.id]).map((c) => ({ id: c.id, label: c.label, count: r.category_counts[c.id]! })),
    groups,
  };
}

// ---- 플레이리스트(담아 둔 소식, Premium) ----

/** 플레이리스트에 담긴 소식(담은 순서). 요약이 없어진 소식(중복 합침 등)은 뺀다 */
export async function getPlaylist(profile: Profile): Promise<LibraryEntry[]> {
  const now = new Date();
  const rows = must(await db.from('playlist_items').select('cluster_id').eq('user_id', profile.id).order('position'), 'playlist_items') as { cluster_id: number }[];
  const ids = rows.map((r) => r.cluster_id);
  if (!ids.length) return [];
  const [info, { reads }] = await Promise.all([clusterInfo(ids), readsAndFeedback(profile.id)]);
  const readMap = new Map(reads.map((r) => [r.cluster_id, r]));
  return ids.flatMap((id) => {
    const c = info.get(id);
    if (!c) return [];
    return [{
      clusterId: id,
      feedDate: '',
      title: c.title,
      short: c.short,
      kind: c.kind,
      category: c.category,
      sourceLabel: c.sourceLabel,
      author: c.author ?? c.sourceLabel,
      publishedLabel: c.publishedAt ? publishedLabel(c.publishedAt, now) : '',
      read: !!readMap.get(id)?.read_at,
      listened: !!readMap.get(id)?.listened_at,
    }];
  });
}

/** 담기: 받은 소식만, 이미 있는 건 건너뛰고 뒤에 붙인다(개수 제한 없음). 담긴 수를 돌려준다 */
export async function addToPlaylist(profile: Profile, ids: number[], max = Infinity): Promise<number> {
  const rows = must(await db.from('playlist_items').select('cluster_id,position').eq('user_id', profile.id), 'playlist_items') as { cluster_id: number; position: number }[];
  const have = new Set(rows.map((r) => r.cluster_id));
  let pos = rows.reduce((m, r) => Math.max(m, r.position), 0);
  const fresh: number[] = [];
  const wanted = [...new Set(ids)].filter((id) => !have.has(id));
  // 여럿이면(비우기 되돌리기 등) 받은 피드를 한 번만 읽어 본다(소식마다 따로 찾으면 그만큼 DB를 오간다)
  let received: Set<number> | null = null;
  if (wanted.length > 3) {
    received = new Set<number>();
    for (const day of await allDays(profile)) for (const row of visibleRows(day)) received.add(row.clusterId);
  }
  for (const id of wanted) {
    if (have.size + fresh.length >= max) break;
    if (!(received ? received.has(id) : await isInUserFeed(profile, id))) continue;
    fresh.push(id);
  }
  if (fresh.length) {
    must(await db.from('playlist_items').insert(fresh.map((cluster_id) => ({ user_id: profile.id, cluster_id, position: ++pos }))), 'playlist_items insert');
  }
  return have.size + fresh.length;
}

export async function isInPlaylist(profile: Profile, clusterId: number): Promise<boolean> {
  const { count } = await db.from('playlist_items').select('cluster_id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('cluster_id', clusterId);
  return (count ?? 0) > 0;
}

export async function removeFromPlaylist(profile: Profile, clusterId: number): Promise<void> {
  must(await db.from('playlist_items').delete().eq('user_id', profile.id).eq('cluster_id', clusterId), 'playlist_items delete');
}

export async function clearPlaylist(profile: Profile): Promise<void> {
  must(await db.from('playlist_items').delete().eq('user_id', profile.id), 'playlist_items clear');
}

/** 끌어서 바꾼 순서를 그대로 저장한다(목록에 없는 id는 무시, 빠진 것은 뒤에 원래 순서로) */
export async function reorderPlaylist(profile: Profile, ids: number[]): Promise<void> {
  const rows = must(await db.from('playlist_items').select('cluster_id').eq('user_id', profile.id).order('position'), 'playlist_items') as { cluster_id: number }[];
  const have = rows.map((r) => r.cluster_id);
  const set = new Set(have);
  const ordered = [...new Set(ids.filter((id) => set.has(id)))];
  const rest = have.filter((id) => !ordered.includes(id));
  const all = [...ordered, ...rest];
  if (!all.length) return;
  must(
    await db.from('playlist_items').upsert(all.map((cluster_id, i) => ({ user_id: profile.id, cluster_id, position: i + 1 })), { onConflict: 'user_id,cluster_id' }),
    'playlist_items reorder',
  );
}

export function toProfileView(p: Profile): ProfileView {
  return {
    id: p.id,
    displayName: p.displayName,
    provider: p.provider,
    email: p.email,
    avatarUrl: p.avatarUrl,
    demo: p.demo,
    plan: p.plan,
    audio: entitlements(p).audio,
    dailyListens: entitlements(p).dailyListens,
    dailyItems: entitlements(p).dailyItems,
    canBuyMaengo: entitlements(p).canBuyMaengo,
    persona: p.persona,
    voice: p.voice,
    autoNext: p.autoNext,
    skipRead: p.skipRead,
    playbackRate: p.playbackRate,
    aiProvider: ai.provider,
    admin: isAdmin(p),
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
