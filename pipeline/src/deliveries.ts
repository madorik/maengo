import { rankFeed } from '@maengo/core/feed';
import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { summarizeCluster } from './jobs/summarize';
import { prepareFresh, widenToGroups } from './instant';
import { loadAudience, loadCandidates, withSimilarExcluded, type Audience } from './lib/audience';
import { HOUR, type Ctx } from './lib/ctx';
import { check, db } from './lib/db';
import { env } from './lib/env';
import { fcmReady, sendPush } from './lib/fcm';
import { mapLimit } from './lib/limit';
import { flushUsage, recordUsage } from './lib/usage';

// 알림 시각에 맹고를 만들고 보낸다(서버 스케줄러). 서버 스케줄러(scheduler.ts)의 deliveries 작업으로 5분마다 돈다.
// 할 일은 delivery_jobs 표(사람·날짜마다 한 줄)로 관리한다:
//   1. 오늘 줄 채우기(plan_deliveries) — 알림 시각을 바꿨으면 대기 중인 줄의 시각도 맞춘다
//   2. 10분 넘게 멈춘 줄 되돌리기(reclaim_stuck_deliveries)
//   3. 만들 시각(알림 30분 전)이 된 줄을 가져가 피드를 만든다 → ready / empty, 실패하면 다시 pending(세 번이면 failed)
//   4. 보낼 시각이 된 ready 줄을 가져가 FCM으로 보낸다 → sent / no_device
// 새벽 GitHub 배치는 수집·요약을 미리 해 두는 일만 한다(사람별 피드는 여기서 만든다).

/** 한 번에 요약할 소식 수. 남은 것은 다음 실행이 한다 */
const MAX_SUMMARIES = 15;
/** Vercel 함수 300초 안에 끝나게, 이만큼 지나면 요약을 더 시작하지 않는다 */
const TIME_BUDGET_MS = 150_000;
/** 5분마다 도니 수집은 한 시간에 한 번이면 된다 */
const COLLECT_AFTER = HOUR;
const BUILD_BATCH = 50;
const SEND_BATCH = 200;

type JobRow = { user_id: string; date: string; attempts: number };

export interface DeliveryResult {
  planned: number;
  reclaimed: number;
  built: number;
  empty: number;
  failed: number;
  sent: number;
  noDevice: number;
  summarized: number;
}

function makeCtx(now: Date): Ctx {
  const log = (m: string) => console.log(`[deliveries] ${m}`);
  return {
    date: kstDate(now),
    now,
    ai: createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log }),
    log,
    stats: {},
    force: false,
    windowHours: 72,
  };
}

/**
 * 이 사람들의 오늘 피드를 만든다. 관심사를 합쳐 최근 글을 처리하고(실패해도 이미 요약된 소식으로 계속),
 * 고른 소식 중 요약이 없는 것만 원하는 사람이 많은 순으로 요약한 뒤 저장한다.
 * 결과: built 새로 만듦, empty 맞는 소식 없음, had 이미 오늘 피드가 있었음(웹에서 받음 등)
 */
export async function buildFeedsFor(ctx: Ctx, userIds: string[]): Promise<{ result: Map<string, 'built' | 'empty' | 'had'>; summarized: number }> {
  const result = new Map<string, 'built' | 'empty' | 'had'>();
  const today = check(await db.from('feed_days').select('user_id').eq('date', ctx.date).in('user_id', userIds), 'feed_days today') as { user_id: string }[];
  for (const r of today) result.set(r.user_id, 'had');
  const audience = await loadAudience(ctx, userIds.filter((id) => !result.has(id)));
  // 관심사가 하나도 없는 사람은 만들 게 없다
  for (const id of userIds) if (!result.has(id) && !audience.some((a) => a.id === id)) result.set(id, 'empty');
  if (!audience.length) return { result, summarized: 0 };

  const union: Audience = { ...audience[0]!, weights: Object.assign({}, ...audience.map((a) => a.weights)) };
  try {
    await prepareFresh(ctx, union, { collectAfter: COLLECT_AFTER });
  } catch (e) {
    // Gemini 임베딩이 막혀도(한도·결제) 이미 요약된 소식으로 피드는 만든다
    ctx.log(`최근 글 처리 실패, 있는 소식으로 계속: ${String((e as Error).message ?? e).slice(0, 160)}`);
  }

  let candidates = await loadCandidates(ctx, { centroids: audience.some((a) => a.known.length > 0) });
  const ready0 = new Set(candidates.filter((c) => c.summarized).map((c) => c.id));
  const picks = new Map<string, { weights: Record<string, number>; exclude: Set<number> }>();
  const want = new Map<number, number>();
  for (const a of audience) {
    const exclude = await withSimilarExcluded(a, candidates);
    let weights = a.weights;
    let picked = rankFeed(candidates, weights, exclude, { limit: a.dailyItems });
    if (!picked.length) {
      weights = widenToGroups(a.weights);
      picked = rankFeed(candidates, weights, exclude, { limit: a.dailyItems });
    }
    picks.set(a.id, { weights, exclude });
    for (const r of picked) if (!ready0.has(r.clusterId)) want.set(r.clusterId, (want.get(r.clusterId) ?? 0) + 1);
  }
  const todo = [...want.entries()].sort((x, y) => y[1] - x[1]).slice(0, MAX_SUMMARIES).map(([id]) => id);
  const t0 = Date.now();
  let summarized = 0;
  await mapLimit(todo, 3, async (id) => {
    if (Date.now() - t0 > TIME_BUDGET_MS) return;
    try {
      if ((await summarizeCluster(ctx, id, 'basic', { videos: 0 })) === 'ok') summarized++;
    } catch (e) {
      ctx.log(`요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  });
  await flushUsage();

  candidates = (await loadCandidates(ctx, { centroids: false })).filter((c) => c.summarized);
  for (const a of audience) {
    const { weights, exclude } = picks.get(a.id)!;
    const ranked = rankFeed(candidates, weights, exclude, { limit: 10 });
    if (!ranked.length) {
      result.set(a.id, 'empty');
      continue;
    }
    const { data: already } = await db.from('feed_days').select('user_id').eq('user_id', a.id).eq('date', ctx.date).maybeSingle();
    if (already) {
      result.set(a.id, 'had');
      continue;
    }
    check(
      await db.from('feeds').insert(ranked.map((r, i) => ({ user_id: a.id, date: ctx.date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }))),
      'feeds insert',
    );
    check(await db.from('feed_days').insert({ user_id: a.id, date: ctx.date, visible: Math.min(ranked.length, a.dailyItems) }), 'feed_days insert');
    result.set(a.id, 'built');
  }
  return { result, summarized };
}

/** 오늘 맹고 알림 문구: 1번 소식 제목과 개수 */
async function messageFor(userId: string, date: string): Promise<{ title: string; body: string; path: string }> {
  const day = (await db.from('feed_days').select('visible').eq('user_id', userId).eq('date', date).maybeSingle()).data as { visible: number } | null;
  const first = (await db.from('feeds').select('cluster_id').eq('user_id', userId).eq('date', date).order('rank').limit(1).maybeSingle()).data as { cluster_id: number } | null;
  const title = first
    ? ((await db.from('summaries').select('title').eq('cluster_id', first.cluster_id).eq('tier', 'basic').maybeSingle()).data as { title: string } | null)?.title
    : null;
  const n = day?.visible ?? 0;
  return {
    title: '오늘의 맹고가 도착했어요',
    body: title ? (n > 1 ? `${title} 외 ${n - 1}개` : title) : `관심사로 고른 소식 ${n}개가 준비됐어요`,
    path: '/today?from=push',
  };
}

const setStatus = (job: JobRow, patch: Record<string, unknown>) =>
  db.from('delivery_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', job.user_id).eq('date', job.date);

export async function runDeliveries(now = new Date()): Promise<DeliveryResult> {
  const ctx = makeCtx(now);
  const out: DeliveryResult = { planned: 0, reclaimed: 0, built: 0, empty: 0, failed: 0, sent: 0, noDevice: 0, summarized: 0 };
  out.planned = Number(check(await db.rpc('plan_deliveries', { p_date: ctx.date }), 'plan_deliveries') ?? 0);
  out.reclaimed = Number(check(await db.rpc('reclaim_stuck_deliveries'), 'reclaim') ?? 0);

  // 만들기
  const builds = (check(await db.rpc('claim_build_jobs', { p_now: now.toISOString(), p_limit: BUILD_BATCH }), 'claim_build_jobs') ?? []) as JobRow[];
  if (builds.length) {
    ctx.log(`만들 차례 ${builds.length}명`);
    try {
      const { result, summarized } = await buildFeedsFor(ctx, builds.map((j) => j.user_id));
      out.summarized = summarized;
      for (const job of builds) {
        const r = result.get(job.user_id) ?? 'empty';
        if (r === 'empty') out.empty++;
        else out.built++;
        await setStatus(job, r === 'empty' ? { status: 'empty' } : { status: 'ready', built_at: new Date().toISOString(), last_error: null });
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
  for (const job of sends) {
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
