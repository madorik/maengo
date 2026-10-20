import { linkCap, rankFeed, type RankedItem } from '@maengo/core/feed';
import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { widenToGroups } from './instant';
import { summarizeCluster } from './jobs/summarize';
import { aiBlockedReason, guardAi, isAiBlocked } from './lib/ai-guard';
import { loadAudience, loadCandidates, loadTopicCandidates, summarizable, withSimilarExcluded, type Audience, type Candidate } from './lib/audience';
import { HOUR, type Ctx } from './lib/ctx';
import { check, db } from './lib/db';
import { env } from './lib/env';
import type { PushMessage } from './lib/fcm';
import { mapLimit } from './lib/limit';
import { pushToUser } from './lib/push';
import { DELIVERY_BUILT_BY, existingFeedResult, isInactive, SEND_RETRY_MINUTES, sendRetryAt } from './lib/retry';
import { flushUsage, recordUsage } from './lib/usage';

// 알림 시각에 소식을 지급하고 알린다(2026-10-15 사용자 결정: 소식 만들기와 따로, 요약은 이때 만든다).
// Supabase pg_cron이 1분마다 /api/cron/deliveries를 부른다(runDeliveryTick). 서버 스케줄러는 하루 한 번(06:00 KST) 수집·임베딩·묶기·태그만 해 둔다.
// 할 일은 delivery_jobs 표(사람·날짜마다 한 줄):
//   1. 오늘 줄 채우기(plan_deliveries) — 만들 시각 = 알림 시각. 알림 시각을 바꿨으면 대기 중인 줄의 시각도 맞춘다
//   2. 10분 넘게 멈춘 줄 되돌리기(reclaim_stuck_deliveries). 날짜가 지난 대기·보낼 차례 줄은 접는다(failed)
//   3. 알림 시각이 된(지난) 줄 중 오늘 소식을 못 받은 사람만, 그 사람 관심사에 맞는 소식을 골라 요약이 없으면 지금 요약해 오늘 피드를 만든다 → ready
//      고를 게 모자라면 기간을 넓혀(사흘 → 일주일 → 한 달) 찾는다. 같은 소식은 여러 사람에게 한 번만 요약한다
//      이미 오늘 소식을 받았으면 had(다시 알리지 않음), 한 달 안에도 맞는 게 없으면 한 시간 뒤 다시(그날 세 번까지) → empty
//      AI가 막혔으면(크레딧 소진·지출 상한) 이미 요약된 소식으로만, 그것도 없으면 30분 뒤 다시. 시간 안에 못 한 사람은 다음 실행이 잇는다
//      일주일 넘게 앱을 안 연 사람은 새로 요약하지 않고 이미 요약된 소식으로만 만든다(알림은 보내 다시 부른다)
//      한 사람이 실패하면(DB 오류 등) 그 사람만 5분 뒤 다시(세 번까지). 배송이 만든 피드(built_by 'delivery')가 이미 있으면 지난 실행이 멈춘 것이라 이어서 알린다
//   4. ready 줄을 FCM으로 보낸다 → sent / no_device / muted(알림 꺼 둠). 만든 그 실행에서 바로 보낸다
//      FCM이 잠깐 실패하면(429·5xx·인증) 1분 → 5분 → 15분 뒤 다시 보낸다(그날 안에서만)
// 서버가 잠깐 멈췄어도 그날 안이면 다음 실행이 알림 시각이 지난 사람을 이어서 챙긴다.

const BUILD_BATCH = 100;
const SEND_BATCH = 200;
/** 고를 소식을 찾는 기간(시간): 사흘 → 일주일 → 한 달. 한 달 지난 묶음은 벡터·행을 정리한다(prune_storage) */
const WINDOWS_H = [72, 7 * 24, 30 * 24];
/** 요약이 '소식 아님'으로 빠질 때를 대비해 하루 소식보다 더 골라 둔다 */
const SPARE = 3;
/** 한 실행에서 새 요약을 시작하는 마감(Vercel 300초 안, 보내기 시간을 남긴다) */
const BUILD_BUDGET_MS = 200_000;
/**
 * Gemini가 429·5xx로 실패했을 때 다시 해 보는 마감과 횟수(처음 + 다시 두 번). 기본(429면 65초씩 네 번)대로 기다리면
 * 300초 실행을 넘겨 줄이 building에 멈췄다가 failed가 됐다. 이 시각을 넘겨 기다려야 하면 다시 하지 않는다.
 * 응답도 이 시각까지만 기다린다(요청마다 남은 시간만큼, core/ai/gemini.ts deadline). 그 뒤 1분은 상태 기록과 보내기 몫
 */
const AI_RETRY_BUDGET_MS = 240_000;
const AI_MAX_ATTEMPTS = 3;
/** 동시에 돌리는 요약 수(모든 사람을 통틀어) */
const SUMMARY_CONCURRENCY = 4;
/** AI가 막혀 못 만들었을 때 다시 해 볼 간격 */
const BLOCKED_RETRY_MS = 30 * 60_000;
/** 한 달 안에도 맞는 소식이 없을 때 다시 해 볼 간격과 횟수(새 글은 하루 한 번 06:00에 들어온다) */
const EMPTY_RETRY_MS = HOUR;
const EMPTY_TRIES = 3;
/** 한 사람을 만들다 실패했을 때(DB 오류 등) 다시 해 볼 간격과 횟수(reclaim_stuck_deliveries도 세 번이면 failed) */
const FAILED_RETRY_MS = 5 * 60_000;
const BUILD_TRIES = 3;
/** 1분마다 도는데 한 번이 길어져도 겹치지 않게(이보다 오래 붙잡고 있으면 죽은 것으로 보고 넘겨받는다) */
const TICK_STALE_MS = 5 * 60_000;
const STALE_NOTE = '날짜가 지나 만들거나 보내지 않음';

/** delivery_jobs 한 줄. attempts는 만들기를 가져간 횟수, ready부터는 보내기가 잠깐 실패한 횟수 */
type JobRow = { user_id: string; date: string; attempts: number };

export interface DeliveryResult {
  planned: number;
  reclaimed: number;
  /** 날짜가 지나 접은 줄 */
  expired: number;
  built: number;
  /** 이미 오늘 소식이 있던 사람(알리지 않음) */
  had: number;
  empty: number;
  /** AI가 막혀 못 만들어 나중에 다시 할 사람 */
  blocked: number;
  /** 이번 실행 시간 안에 못 해 다음 실행으로 넘긴 사람 */
  later: number;
  summarized: number;
  failed: number;
  sent: number;
  noDevice: number;
  /** 알림을 꺼 둬서 보내지 않음 */
  muted: number;
  /** 푸시가 잠깐 실패해 잠시 뒤 다시 보낼 사람 */
  retried: number;
}

function makeCtx(now: Date, aiUntil: number): Ctx {
  const log = (m: string) => console.log(`[deliveries] ${m}`);
  return {
    date: kstDate(now),
    now,
    ai: guardAi(
      createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log, maxAttempts: AI_MAX_ATTEMPTS, retryUntil: aiUntil, deadline: aiUntil }),
    ),
    log,
    stats: {},
    force: false,
    windowHours: 72,
  };
}

type BuildResult = 'built' | 'empty' | 'had' | 'blocked' | 'later' | 'failed';

/** 마지막으로 앱을 연 지 일주일이 넘은 사람. 열(last_seen_at)이 없으면(마이그레이션 20261018192100 전) 모두 활동 중으로 본다 */
async function inactiveUsers(ids: string[], now: Date): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await db.from('profiles').select('id,last_seen_at,created_at').in('id', ids);
  if (error) {
    console.error('[deliveries] profiles last_seen_at', error.message);
    return new Set();
  }
  const rows = (data ?? []) as { id: string; last_seen_at: string | null; created_at: string | null }[];
  return new Set(rows.filter((p) => isInactive(p.last_seen_at, p.created_at, now)).map((p) => p.id));
}

/**
 * 고른 소식을 오늘 피드로 넣는다. 그사이 웹에서 먼저 받았으면 그쪽을 둔다(이미 있는 피드는 lib/retry.ts existingFeedResult로 본다).
 * 순번이 겹치는데 오늘 피드(feed_days)가 없으면 지난 시도가 피드 줄만 넣고 멈춘 것이라 지우고 다시 넣는다.
 * attempts = 이 줄을 가져간 횟수(이번 포함)
 */
async function saveFeed(a: Audience, date: string, got: RankedItem[], want: number, attempts: number): Promise<BuildResult> {
  const dayOf = async () => check(await db.from('feed_days').select('built_by').eq('user_id', a.id).eq('date', date).maybeSingle(), 'feed_days') as { built_by: string } | null;
  const already = await dayOf();
  if (already) return existingFeedResult(already.built_by, attempts);
  const rows = got.map((r, i) => ({ user_id: a.id, date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }));
  let { error } = await db.from('feeds').insert(rows);
  if (error?.code === '23505') {
    const day = await dayOf();
    if (day) return existingFeedResult(day.built_by, attempts);
    check(await db.from('feeds').delete().eq('user_id', a.id).eq('date', date), 'feeds clear');
    ({ error } = await db.from('feeds').insert(rows));
  }
  if (error) throw new Error(`feeds insert: ${error.message}`);
  // 배송이 만든 것으로 표시한다(멈춘 뒤 다음 실행이 알아보고 이어서 알리게). 표시를 허용하는 마이그레이션(20261018201000) 전이면 거절(23514)되니 열 기본값('pipeline')으로 넣는다
  const day = { user_id: a.id, date, visible: Math.min(got.length, want) };
  let { error: dayError } = await db.from('feed_days').insert({ ...day, built_by: DELIVERY_BUILT_BY });
  if (dayError?.code === '23514') ({ error: dayError } = await db.from('feed_days').insert(day));
  if (dayError?.code === '23505') return 'had';
  if (dayError) throw new Error(`feed_days insert: ${dayError.message}`);
  return 'built';
}

/**
 * 이 사람들의 오늘 피드를 만든다. 사람마다 관심사로 소식을 골라(모자라면 기간을 넓혀 한 달까지), 위에서부터 요약해 하루 소식만큼 모은다.
 * 요약이 없는 소식은 지금 요약한다(같은 소식은 한 번만, 동시에 SUMMARY_CONCURRENCY개). deadline이 지나면 새 요약을 시작하지 않는다.
 * 한 사람의 실패는 그 사람만 failed로 두고(errors에 이유) 나머지는 계속한다. 사용량은 끝나면(실패해도) 마저 남긴다.
 * attempts = 사람마다 이 줄을 가져간 횟수(이번 포함). 이미 있는 피드가 멈춘 배송의 것인지 볼 때 쓴다(없으면 처음으로 본다)
 */
export async function buildFeedsFor(
  ctx: Ctx,
  userIds: string[],
  deadline: number,
  attempts: ReadonlyMap<string, number> = new Map(),
): Promise<{ result: Map<string, BuildResult>; errors: Map<string, string>; summarized: number }> {
  const result = new Map<string, BuildResult>();
  const errors = new Map<string, string>();
  let summarized = 0;
  const triesOf = (id: string) => attempts.get(id) ?? 1;
  try {
    const today = check(await db.from('feed_days').select('user_id,built_by').eq('date', ctx.date).in('user_id', userIds), 'feed_days today') as { user_id: string; built_by: string }[];
    for (const r of today) result.set(r.user_id, existingFeedResult(r.built_by, triesOf(r.user_id)));
    const audience = await loadAudience(ctx, userIds.filter((id) => !result.has(id)));
    // 관심사가 하나도 없는 사람은 만들 게 없다
    for (const id of userIds) if (!result.has(id) && !audience.some((a) => a.id === id)) result.set(id, 'empty');
    if (!audience.length) return { result, errors, summarized };
    const inactive = await inactiveUsers(audience.map((a) => a.id), ctx.now);
    if (inactive.size) ctx.log(`일주일 넘게 앱을 안 연 사람 ${inactive.size}명은 이미 요약된 소식으로만`);

    let aiBlocked = (await aiBlockedReason()) !== null;
    const base = await loadCandidates(ctx, { centroids: audience.some((a) => a.known.length > 0), sinceHours: WINDOWS_H[0], freshHours: WINDOWS_H[0] });
    /** 지금까지 본 후보(넓힌 기간에서 찾은 것까지). 요약을 마치면 summarized를 켠다 */
    const seen = new Map<number, Candidate>(base.map((c) => [c.id, c]));

    // 요약: 같은 소식은 한 번만, 모든 사람을 통틀어 동시에 SUMMARY_CONCURRENCY개
    let active = 0;
    const waiting: (() => void)[] = [];
    const acquire = () => (active < SUMMARY_CONCURRENCY ? (active++, Promise.resolve()) : new Promise<void>((r) => waiting.push(() => (active++, r()))));
    const release = () => {
      active--;
      waiting.shift()?.();
    };
    const once = new Map<number, Promise<boolean>>();
    const ensureSummary = (id: number): Promise<boolean> => {
      if (seen.get(id)?.summarized) return Promise.resolve(true);
      let p = once.get(id);
      if (!p) {
        p = (async () => {
          await acquire();
          try {
            if (aiBlocked || Date.now() > deadline) return false;
            const r = await summarizeCluster(ctx, id, 'basic', { videos: 0 });
            if (r !== 'ok') return false;
            summarized++;
            const c = seen.get(id);
            if (c) c.summarized = true;
            return true;
          } catch (e) {
            if (isAiBlocked(e)) aiBlocked = true;
            ctx.log(`요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
            return false;
          } finally {
            release();
          }
        })();
        once.set(id, p);
      }
      return p;
    };

    const buildOne = async (a: Audience): Promise<BuildResult> => {
      if (Date.now() > deadline) return 'later';
      const exclude = await withSimilarExcluded(a, base);
      const want = a.dailyItems;
      const widened = widenToGroups(a.weights);
      const mayMake = !inactive.has(a.id);
      // AI가 막혔거나 오래 안 온 사람이면 이미 요약된 것만 고른다. 요약 안 된 영상은 여기서 요약하지 않으니(videos: 0) 뺀다(summarizable).
      // 고른 관심사로 모자라면 같은 분야 전체로 넓혀 본다
      const pick = (): RankedItem[] => {
        const pool = [...seen.values()].filter((c) => summarizable(c) && (c.summarized || (mayMake && !aiBlocked)));
        // 내 관심 링크 글은 하루 소식의 절반까지(D19). 여분(SPARE)에도 같은 상한을 둔다
        const opts = { limit: want + SPARE, maxLinks: linkCap(want) };
        const narrow = rankFeed(pool, a.weights, exclude, opts);
        if (narrow.length >= want) return narrow;
        const wide = rankFeed(pool, widened, exclude, opts);
        return wide.length > narrow.length ? wide : narrow;
      };
      let ranked = pick();
      // 모자라면 이 사람 관심사의 더 오래된 소식을 구간별로 더 찾는다(사흘~일주일 → 일주일~한 달)
      for (let w = 1; w < WINDOWS_H.length && ranked.length < want; w++) {
        for (const c of await loadTopicCandidates(ctx, Object.keys(widened), { sinceHours: WINDOWS_H[w]!, untilHours: WINDOWS_H[w - 1]! })) if (!seen.has(c.id)) seen.set(c.id, c);
        ranked = pick();
      }
      // 위에서부터 요약해 하루 소식만큼 모은다. '소식 아님'으로 빠지면 다음 것으로 채운다
      const got: RankedItem[] = [];
      for (let i = 0; i < ranked.length && got.length < want; ) {
        const batch = ranked.slice(i, i + (want - got.length));
        i += batch.length;
        const ok = await Promise.all(batch.map((r) => ensureSummary(r.clusterId)));
        batch.forEach((r, k) => ok[k] && got.push(r));
        if (Date.now() > deadline) break;
      }
      if (!got.length) return Date.now() > deadline ? 'later' : aiBlocked ? 'blocked' : 'empty';
      return saveFeed(a, ctx.date, got, want, triesOf(a.id));
    };

    await mapLimit(audience, 4, async (a) => {
      try {
        result.set(a.id, await buildOne(a));
      } catch (e) {
        // 한 사람의 실패(순번 충돌, 잠깐의 DB 오류 등)가 같이 가져간 사람 모두를 되돌리지 않게 그 사람만 실패로 둔다
        const msg = String((e as Error).message ?? e).slice(0, 300);
        ctx.log(`${a.id.slice(0, 8)} 만들기 실패: ${msg}`);
        result.set(a.id, 'failed');
        errors.set(a.id, msg);
      }
    });
    return { result, errors, summarized };
  } finally {
    await flushUsage();
  }
}

/** 오늘 소식 알림 문구: 1번 소식 제목과 개수. 보여 줄 소식이 없으면 null(빈 알림을 보내지 않는다) */
async function messageFor(userId: string, date: string): Promise<PushMessage | null> {
  const day = check(await db.from('feed_days').select('visible').eq('user_id', userId).eq('date', date).maybeSingle(), 'feed_days visible') as { visible: number } | null;
  if (!day?.visible) return null;
  const first = (await db.from('feeds').select('cluster_id').eq('user_id', userId).eq('date', date).order('rank').limit(1).maybeSingle()).data as { cluster_id: number } | null;
  const title = first
    ? ((await db.from('summaries').select('title').eq('cluster_id', first.cluster_id).eq('tier', 'basic').maybeSingle()).data as { title: string } | null)?.title
    : null;
  const n = day.visible;
  return {
    title: '오늘의 소식이 도착했어요',
    body: title ? (n > 1 ? `${title} 외 ${n - 1}개` : title) : `관심사로 고른 소식 ${n}개가 준비됐어요`,
    path: '/today?from=push',
  };
}

const setStatus = (job: JobRow, patch: Record<string, unknown>) =>
  db.from('delivery_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', job.user_id).eq('date', job.date);

/**
 * 날짜가 지난 대기·보낼 차례 줄을 접는다. 어제 줄을 자정 넘어 만들면 오늘 날짜로 피드를 만들어
 * 알림은 어제 날짜(빈 소식 '0개')를 가리키고, 오늘 줄은 그 피드를 보고 had가 되어 알림이 안 갔다
 */
async function expireStale(today: string): Promise<number> {
  const rows = check(
    await db
      .from('delivery_jobs')
      .update({ status: 'failed', last_error: STALE_NOTE, updated_at: new Date().toISOString() })
      .lt('date', today)
      .in('status', ['pending', 'ready'])
      .select('user_id'),
    'delivery_jobs expire',
  ) as { user_id: string }[];
  return rows.length;
}

export async function runDeliveries(now = new Date()): Promise<DeliveryResult> {
  const started = Date.now();
  const ctx = makeCtx(now, started + AI_RETRY_BUDGET_MS);
  const out: DeliveryResult = { planned: 0, reclaimed: 0, expired: 0, built: 0, had: 0, empty: 0, blocked: 0, later: 0, summarized: 0, failed: 0, sent: 0, noDevice: 0, muted: 0, retried: 0 };
  const deadline = started + BUILD_BUDGET_MS;
  out.planned = Number(check(await db.rpc('plan_deliveries', { p_date: ctx.date }), 'plan_deliveries') ?? 0);
  out.reclaimed = Number(check(await db.rpc('reclaim_stuck_deliveries'), 'reclaim') ?? 0);
  out.expired = await expireStale(ctx.date);

  // 만들기: 알림 시각이 된(지난) 사람 중 아직 못 받은 사람만. 자정 즈음 가져간 어제 줄(드물다)도 같은 이유로 접는다
  const claimed = (check(await db.rpc('claim_build_jobs', { p_now: now.toISOString(), p_limit: BUILD_BATCH }), 'claim_build_jobs') ?? []) as JobRow[];
  const builds: JobRow[] = [];
  for (const job of claimed) {
    if (job.date === ctx.date) builds.push(job);
    else {
      out.expired++;
      await setStatus(job, { status: 'failed', last_error: STALE_NOTE });
    }
  }
  if (builds.length) {
    ctx.log(`알림 시각이 된 사람 ${builds.length}명`);
    try {
      const { result, errors, summarized } = await buildFeedsFor(ctx, builds.map((j) => j.user_id), deadline, new Map(builds.map((j) => [j.user_id, j.attempts])));
      out.summarized = summarized;
      for (const job of builds) {
        const r = result.get(job.user_id) ?? 'empty';
        if (r === 'later') {
          // 이번 실행 시간 안에 못 했다: 다음 실행(1분 뒤)이 잇는다(시도 횟수는 세지 않는다)
          out.later++;
          await setStatus(job, { status: 'pending', attempts: Math.max(0, job.attempts - 1) });
        } else if (r === 'blocked') {
          // AI가 막혀 고를 게 없었다: 그날 안이면 30분 뒤 다시, 날이 넘어가면 failed
          out.blocked++;
          const retryAt = new Date(Date.now() + BLOCKED_RETRY_MS);
          await setStatus(
            job,
            kstDate(retryAt) === job.date
              ? { status: 'pending', build_at: retryAt.toISOString(), last_error: 'AI가 막혀 다시 시도' }
              : { status: 'failed', last_error: 'AI가 막혀 그날 만들지 못함' },
          );
        } else if (r === 'had') {
          out.had++;
          await setStatus(job, { status: 'had', last_error: null });
        } else if (r === 'empty') {
          // 한 달 안에도 이 사람 관심사에 맞는 소식이 없다: 그날 안이면 한 시간 뒤 다시(새 글은 하루 한 번 06:00에 들어온다)
          out.empty++;
          const retryAt = new Date(Date.now() + EMPTY_RETRY_MS);
          await setStatus(
            job,
            job.attempts < EMPTY_TRIES && kstDate(retryAt) === job.date
              ? { status: 'pending', build_at: retryAt.toISOString(), last_error: '맞는 소식이 없어 다시 시도' }
              : { status: 'empty', last_error: null },
          );
        } else if (r === 'failed') {
          // 이 사람만 실패했다(DB 오류 등): 그날 안이면 5분 뒤 다시, 세 번이면 failed
          out.failed++;
          const msg = errors.get(job.user_id) ?? '만들기 실패';
          const retryAt = new Date(Date.now() + FAILED_RETRY_MS);
          await setStatus(
            job,
            job.attempts < BUILD_TRIES && kstDate(retryAt) === job.date
              ? { status: 'pending', build_at: retryAt.toISOString(), last_error: msg }
              : { status: 'failed', last_error: msg },
          );
        } else {
          out.built++;
          // 여기서부터 attempts는 보내기가 잠깐 실패한 횟수
          await setStatus(job, { status: 'ready', built_at: new Date().toISOString(), attempts: 0, last_error: null });
        }
      }
    } catch (e) {
      // 같이 가져간 사람 모두에 걸린 실패(후보를 못 읽음 등). 그새 만든 사람은 다음 실행이 배송 피드를 보고 이어서 알린다
      const msg = String((e as Error).message ?? e).slice(0, 300);
      ctx.log(`만들기 실패: ${msg}`);
      for (const job of builds) {
        out.failed++;
        await setStatus(job, { status: job.attempts >= BUILD_TRIES ? 'failed' : 'pending', last_error: msg });
      }
    }
  }
  // 보내기
  const sends = (check(await db.rpc('claim_send_jobs', { p_now: now.toISOString(), p_limit: SEND_BATCH }), 'claim_send_jobs') ?? []) as JobRow[];
  // 알림을 꺼 둔 사람은 보내지 않는다(보낼 때 다시 읽어 직전에 끈 것도 지킨다)
  const pushOn = new Set(
    sends.length
      ? (check(await db.from('profiles').select('id').in('id', sends.map((j) => j.user_id)).eq('push_enabled', true), 'profiles push_enabled') as { id: string }[]).map((p) => p.id)
      : [],
  );
  /** 잠깐의 실패: 그날 안이면 잠시 뒤 다시 보낼 차례로, 횟수를 다 쓰면 no_device */
  const retryLater = async (job: JobRow, note: string) => {
    const tries = job.attempts + 1;
    const at = sendRetryAt(tries, new Date(), job.date);
    if (at) {
      out.retried++;
      await setStatus(job, { status: 'ready', notify_at: at.toISOString(), attempts: tries, last_error: `${note} → 다시(${tries}/${SEND_RETRY_MINUTES.length})`.slice(0, 300) });
    } else {
      out.noDevice++;
      await setStatus(job, { status: 'no_device', last_error: `${note}(다시 보내기를 다 씀)`.slice(0, 300) });
    }
  };
  for (const job of sends) {
    if (!pushOn.has(job.user_id)) {
      out.muted++;
      await setStatus(job, { status: 'muted' });
      continue;
    }
    try {
      const msg = await messageFor(job.user_id, job.date);
      if (!msg) {
        out.failed++;
        await setStatus(job, { status: 'failed', last_error: '보낼 소식이 없음' });
        continue;
      }
      const r = await pushToUser(job.user_id, msg);
      if (r.status === 'sent') {
        out.sent++;
        await setStatus(job, { status: 'sent', sent_at: new Date().toISOString(), last_error: null });
        await db.from('notifications_log').upsert({ user_id: job.user_id, date: job.date, channel: 'push' }, { onConflict: 'user_id,date,channel', ignoreDuplicates: true });
      } else if (r.status === 'retry') {
        await retryLater(job, r.note);
      } else {
        // 보낼 수 있는 기기가 없었다(토큰 없음·모두 죽은 토큰·다시 해도 같은 실패)
        out.noDevice++;
        await setStatus(job, { status: 'no_device', last_error: r.note });
      }
    } catch (e) {
      // DB를 못 읽는 등 예상 못 한 실패도 잠깐의 실패로 본다
      await retryLater(job, String((e as Error).message ?? e).slice(0, 160));
    }
  }
  if (builds.length || sends.length || out.expired) ctx.log(JSON.stringify(out));
  return out;
}

/**
 * 1분마다 한 번(/api/cron/deliveries). scheduler_tasks의 deliveries 줄을 잠금으로 써서 겹쳐 돌지 않게 하고 결과를 남긴다.
 * 그 줄은 enabled=false라 서버 스케줄러(ingest·daily)는 가져가지 않는다.
 */
export async function runDeliveryTick(now = new Date()): Promise<DeliveryResult | 'busy'> {
  const stale = new Date(now.getTime() - TICK_STALE_MS).toISOString();
  const claimed = check(
    await db
      .from('scheduler_tasks')
      .update({ running_since: now.toISOString(), last_started_at: now.toISOString() })
      .eq('name', 'deliveries')
      .or(`running_since.is.null,running_since.lt.${stale}`)
      .select('name'),
    'deliveries claim',
  ) as { name: string }[];
  if (!claimed.length) return 'busy';
  try {
    const out = await runDeliveries(now);
    await db.from('scheduler_tasks').update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'ok', last_error: null, last_stats: out }).eq('name', 'deliveries');
    return out;
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 300);
    // last_status는 'ok' | 'failed'만 된다(전엔 'error'를 써서 기록이 통째로 거절돼 잠금이 5분 동안 안 풀렸다)
    const { error } = await db.from('scheduler_tasks').update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'failed', last_error: msg }).eq('name', 'deliveries');
    if (error) console.error('[deliveries] 결과 기록 실패', error.message);
    throw e;
  }
}
