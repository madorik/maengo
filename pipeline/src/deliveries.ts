import { linkCap, rankFeed, type RankedItem } from '@maengo/core/feed';
import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { widenToGroups } from './instant';
import { summarizeCluster } from './jobs/summarize';
import { aiBlockedReason, guardAi, isAiBlocked } from './lib/ai-guard';
import { loadAudience, loadCandidates, loadTopicCandidates, withSimilarExcluded, type Candidate } from './lib/audience';
import { HOUR, type Ctx } from './lib/ctx';
import { check, db } from './lib/db';
import { env } from './lib/env';
import { fcmReady, sendPush } from './lib/fcm';
import { mapLimit } from './lib/limit';
import { flushUsage, recordUsage } from './lib/usage';

// 알림 시각에 소식을 지급하고 알린다(2026-10-15 사용자 결정: 소식 만들기와 따로, 요약은 이때 만든다).
// Supabase pg_cron이 1분마다 /api/cron/deliveries를 부른다(runDeliveryTick). 서버 스케줄러는 3시간마다 수집·임베딩·묶기·태그만 해 둔다.
// 할 일은 delivery_jobs 표(사람·날짜마다 한 줄):
//   1. 오늘 줄 채우기(plan_deliveries) — 만들 시각 = 알림 시각. 알림 시각을 바꿨으면 대기 중인 줄의 시각도 맞춘다
//   2. 10분 넘게 멈춘 줄 되돌리기(reclaim_stuck_deliveries)
//   3. 알림 시각이 된(지난) 줄 중 오늘 소식을 못 받은 사람만, 그 사람 관심사에 맞는 소식을 골라 요약이 없으면 지금 요약해 오늘 피드를 만든다 → ready
//      고를 게 모자라면 기간을 넓혀(사흘 → 일주일 → 한 달 → 석 달) 찾는다. 같은 소식은 여러 사람에게 한 번만 요약한다
//      이미 오늘 소식을 받았으면 had(다시 알리지 않음), 석 달 안에도 맞는 게 없으면 한 시간 뒤 다시(그날 세 번까지) → empty
//      AI가 막혔으면(크레딧 소진·지출 상한) 이미 요약된 소식으로만, 그것도 없으면 30분 뒤 다시. 시간 안에 못 한 사람은 다음 실행이 잇는다
//   4. ready 줄을 FCM으로 보낸다 → sent / no_device / muted(알림 꺼 둠). 만든 그 실행에서 바로 보낸다
// 서버가 잠깐 멈췄어도 그날 안이면 다음 실행이 알림 시각이 지난 사람을 이어서 챙긴다.

const BUILD_BATCH = 100;
const SEND_BATCH = 200;
/** 고를 소식을 찾는 기간(시간): 사흘 → 일주일 → 한 달 → 석 달 */
const WINDOWS_H = [72, 7 * 24, 30 * 24, 90 * 24];
/** 요약이 '소식 아님'으로 빠질 때를 대비해 하루 소식보다 더 골라 둔다 */
const SPARE = 3;
/** 한 실행에서 새 요약을 시작하는 마감(Vercel 300초 안, 보내기 시간을 남긴다) */
const BUILD_BUDGET_MS = 200_000;
/** 동시에 돌리는 요약 수(모든 사람을 통틀어) */
const SUMMARY_CONCURRENCY = 4;
/** AI가 막혀 못 만들었을 때 다시 해 볼 간격 */
const BLOCKED_RETRY_MS = 30 * 60_000;
/** 석 달 안에도 맞는 소식이 없을 때 다시 해 볼 간격과 횟수(새 글은 3시간마다 들어온다) */
const EMPTY_RETRY_MS = HOUR;
const EMPTY_TRIES = 3;
/** 1분마다 도는데 한 번이 길어져도 겹치지 않게(이보다 오래 붙잡고 있으면 죽은 것으로 보고 넘겨받는다) */
const TICK_STALE_MS = 5 * 60_000;

type JobRow = { user_id: string; date: string; attempts: number };

export interface DeliveryResult {
  planned: number;
  reclaimed: number;
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
}

function makeCtx(now: Date): Ctx {
  const log = (m: string) => console.log(`[deliveries] ${m}`);
  return {
    date: kstDate(now),
    now,
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log })),
    log,
    stats: {},
    force: false,
    windowHours: 72,
  };
}

type BuildResult = 'built' | 'empty' | 'had' | 'blocked' | 'later';

/**
 * 이 사람들의 오늘 피드를 만든다. 사람마다 관심사로 소식을 골라(모자라면 기간을 넓혀 석 달까지), 위에서부터 요약해 하루 소식만큼 모은다.
 * 요약이 없는 소식은 지금 요약한다(같은 소식은 한 번만, 동시에 SUMMARY_CONCURRENCY개). deadline이 지나면 새 요약을 시작하지 않는다.
 */
export async function buildFeedsFor(ctx: Ctx, userIds: string[], deadline: number): Promise<{ result: Map<string, BuildResult>; summarized: number }> {
  const result = new Map<string, BuildResult>();
  const today = check(await db.from('feed_days').select('user_id').eq('date', ctx.date).in('user_id', userIds), 'feed_days today') as { user_id: string }[];
  for (const r of today) result.set(r.user_id, 'had');
  const audience = await loadAudience(ctx, userIds.filter((id) => !result.has(id)));
  // 관심사가 하나도 없는 사람은 만들 게 없다
  for (const id of userIds) if (!result.has(id) && !audience.some((a) => a.id === id)) result.set(id, 'empty');
  if (!audience.length) return { result, summarized: 0 };

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
  let summarized = 0;
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

  await mapLimit(audience, 4, async (a) => {
    if (Date.now() > deadline) return void result.set(a.id, 'later');
    const exclude = await withSimilarExcluded(a, base);
    const want = a.dailyItems;
    const widened = widenToGroups(a.weights);
    // AI가 막혔으면 이미 요약된 것만 고른다. 고른 관심사로 모자라면 같은 분야 전체로 넓혀 본다
    const pick = (): RankedItem[] => {
      const pool = [...seen.values()].filter((c) => !aiBlocked || c.summarized);
      // 내 관심 링크 글은 하루 소식의 절반까지(D19). 여분(SPARE)에도 같은 상한을 둔다
      const opts = { limit: want + SPARE, maxLinks: linkCap(want) };
      const narrow = rankFeed(pool, a.weights, exclude, opts);
      if (narrow.length >= want) return narrow;
      const wide = rankFeed(pool, widened, exclude, opts);
      return wide.length > narrow.length ? wide : narrow;
    };
    let ranked = pick();
    // 모자라면 이 사람 관심사의 더 오래된 소식을 구간별로 더 찾는다(사흘~일주일 → 일주일~한 달 → 한 달~석 달)
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
    if (!got.length) return void result.set(a.id, Date.now() > deadline ? 'later' : aiBlocked ? 'blocked' : 'empty');
    // 그사이 웹에서 먼저 받았으면 그쪽을 둔다
    const { data: already } = await db.from('feed_days').select('user_id').eq('user_id', a.id).eq('date', ctx.date).maybeSingle();
    if (already) return void result.set(a.id, 'had');
    check(
      await db.from('feeds').insert(got.map((r, i) => ({ user_id: a.id, date: ctx.date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }))),
      'feeds insert',
    );
    check(await db.from('feed_days').insert({ user_id: a.id, date: ctx.date, visible: Math.min(got.length, want) }), 'feed_days insert');
    result.set(a.id, 'built');
  });
  await flushUsage();
  return { result, summarized };
}

/** 오늘 소식 알림 문구: 1번 소식 제목과 개수 */
async function messageFor(userId: string, date: string): Promise<{ title: string; body: string; path: string }> {
  const day = (await db.from('feed_days').select('visible').eq('user_id', userId).eq('date', date).maybeSingle()).data as { visible: number } | null;
  const first = (await db.from('feeds').select('cluster_id').eq('user_id', userId).eq('date', date).order('rank').limit(1).maybeSingle()).data as { cluster_id: number } | null;
  const title = first
    ? ((await db.from('summaries').select('title').eq('cluster_id', first.cluster_id).eq('tier', 'basic').maybeSingle()).data as { title: string } | null)?.title
    : null;
  const n = day?.visible ?? 0;
  return {
    title: '오늘의 소식이 도착했어요',
    body: title ? (n > 1 ? `${title} 외 ${n - 1}개` : title) : `관심사로 고른 소식 ${n}개가 준비됐어요`,
    path: '/today?from=push',
  };
}

const setStatus = (job: JobRow, patch: Record<string, unknown>) =>
  db.from('delivery_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', job.user_id).eq('date', job.date);

export async function runDeliveries(now = new Date()): Promise<DeliveryResult> {
  const ctx = makeCtx(now);
  const out: DeliveryResult = { planned: 0, reclaimed: 0, built: 0, had: 0, empty: 0, blocked: 0, later: 0, summarized: 0, failed: 0, sent: 0, noDevice: 0, muted: 0 };
  const deadline = Date.now() + BUILD_BUDGET_MS;
  out.planned = Number(check(await db.rpc('plan_deliveries', { p_date: ctx.date }), 'plan_deliveries') ?? 0);
  out.reclaimed = Number(check(await db.rpc('reclaim_stuck_deliveries'), 'reclaim') ?? 0);

  // 만들기: 알림 시각이 된(지난) 사람 중 아직 못 받은 사람만
  const builds = (check(await db.rpc('claim_build_jobs', { p_now: now.toISOString(), p_limit: BUILD_BATCH }), 'claim_build_jobs') ?? []) as JobRow[];
  if (builds.length) {
    ctx.log(`알림 시각이 된 사람 ${builds.length}명`);
    try {
      const { result, summarized } = await buildFeedsFor(ctx, builds.map((j) => j.user_id), deadline);
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
          // 석 달 안에도 이 사람 관심사에 맞는 소식이 없다: 그날 안이면 한 시간 뒤 다시(새 글은 3시간마다 들어온다)
          out.empty++;
          const retryAt = new Date(Date.now() + EMPTY_RETRY_MS);
          await setStatus(
            job,
            job.attempts < EMPTY_TRIES && kstDate(retryAt) === job.date
              ? { status: 'pending', build_at: retryAt.toISOString(), last_error: '맞는 소식이 없어 다시 시도' }
              : { status: 'empty', last_error: null },
          );
        } else {
          out.built++;
          await setStatus(job, { status: 'ready', built_at: new Date().toISOString(), last_error: null });
        }
      }
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 300);
      ctx.log(`만들기 실패: ${msg}`);
      for (const job of builds) {
        out.failed++;
        await setStatus(job, { status: job.attempts >= 3 ? 'failed' : 'pending', last_error: msg });
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
  for (const job of sends) {
    if (!pushOn.has(job.user_id)) {
      out.muted++;
      await setStatus(job, { status: 'muted' });
      continue;
    }
    const tokens = (check(await db.from('device_tokens').select('token').eq('user_id', job.user_id), 'device_tokens') as { token: string }[]).map((t) => t.token);
    if (!tokens.length || !fcmReady()) {
      out.noDevice++;
      await setStatus(job, { status: 'no_device' });
      continue;
    }
    const msg = await messageFor(job.user_id, job.date);
    const results = await mapLimit(tokens, 5, (t) => sendPush(t, msg, env.siteUrl).catch(() => 'error' as const));
    const dead = tokens.filter((_, i) => results[i] === 'dead');
    if (dead.length) await db.from('device_tokens').delete().in('token', dead);
    if (results.includes('ok')) {
      out.sent++;
      await setStatus(job, { status: 'sent', sent_at: new Date().toISOString(), last_error: null });
      await db.from('notifications_log').upsert({ user_id: job.user_id, date: job.date, channel: 'push' }, { onConflict: 'user_id,date,channel', ignoreDuplicates: true });
    } else {
      // 보낼 수 있는 기기가 없었다(모두 죽은 토큰이거나 발송 실패)
      out.noDevice++;
      await setStatus(job, { status: 'no_device', last_error: results.includes('error') ? 'FCM 발송 실패' : '살아 있는 기기 토큰 없음' });
    }
  }
  if (builds.length || sends.length) ctx.log(JSON.stringify(out));
  return out;
}

/**
 * 1분마다 한 번(/api/cron/deliveries). scheduler_tasks의 deliveries 줄을 잠금으로 써서 겹쳐 돌지 않게 하고 결과를 남긴다.
 * 그 줄은 enabled=false라 서버 스케줄러(3시간 작업들)는 가져가지 않는다.
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
    await db.from('scheduler_tasks').update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'error', last_error: msg }).eq('name', 'deliveries');
    throw e;
  }
}
