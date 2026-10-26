import { createGeminiAi, GEMINI_MIN_REQUEST_MS, GeminiTimeoutError } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { cluster } from './jobs/cluster';
import { collect } from './jobs/collect';
import { dedupe } from './jobs/dedupe';
import { embed } from './jobs/embed';
import { summarize } from './jobs/summarize';
import { tag } from './jobs/tag';
import type { Ctx } from './lib/ctx';
import { check, db, selectAll } from './lib/db';
import { guardAi } from './lib/ai-guard';
import { env } from './lib/env';
import { afterTaskFailure, afterTaskSuccess, type TaskRow } from './lib/retry';
import { TRIAL_PUSH_MS } from './lib/trial';
import { flushUsage, recordUsage } from './lib/usage';
import { remindTrialEnding } from './trial-reminder';

// 서버 스케줄러(Supabase pg_cron이 5분마다 웹 /api/cron/scheduler를 부른다). 하루 한 번(06:00 KST) 수집·임베딩·묶기·태그·중복 합치기와 하루 정리만 한다.
// 요약은 미리 만들지 않는다: 알림 시각에 배송이 그 사람 소식을 골라 그때 요약한다(deliveries.ts, 1분마다. 2026-10-15 사용자 결정).
// summarize 작업은 표에서 꺼 두었다(enabled=false, 필요하면 켤 수 있게 코드는 남긴다).
// 무엇을 언제 돌릴지는 scheduler_tasks 표가 정한다: 차례가 된 작업만 가져와 돌리고, 결과와 다음 차례를 표에 남긴다.
// Vercel 함수는 300초까지라 한 번에 약 4분 예산을 두고, 다 못 한 작업은 놓아줘 다음 실행이 이어받는다.
// 작업이 실패하면 30분 뒤 다시(하루 세 번까지, lib/retry.ts). 관리자 화면 알림 종에 띄운다(apps/web/lib/server/admin-alerts.ts).
// trial_reminder(하루 한 번 12:00 KST): 내일 무료 체험이 끝나는 사람에게 푸시 한 번(trial-reminder.ts).
// 작업이 '다 못 했다'(unfinished)고 하면 성공으로 적지 않고 놓아줘 다음 실행(5분 뒤)이 바로 잇는다(차례 시각은 그대로).

/** 이 시각까지만 새 작업을 시작한다(시작 후 4분) */
const BUDGET_MS = 240_000;
/**
 * Gemini 요청은 이 시각까지 끊는다(시작 후 280초). Vercel 함수는 300초에 끊겨, 그 전에 실패로 적고 잠금을 풀 시간을 남긴다.
 * 전엔 4분 예산 끝에 시작한 요청이 응답을 오래 기다리면 실행이 통째로 끊겼다(2026-10-18 점검)
 */
const AI_HARD_MS = 280_000;
/** 작업마다 최소 이만큼은 남아 있어야 시작한다(수집은 출처 79곳에 약 10초, 임베딩은 300개에 수십 초, 체험 끝 알림은 한 사람 보낼 시간) */
const MIN_LEFT_MS: Record<string, number> = { daily: 0, trial_reminder: TRIAL_PUSH_MS, ingest: 60_000, summarize: 60_000 };
/** 가벼운 하루 정리를 먼저, 무거운 요약은 마지막에 */
const ORDER = ['daily', 'trial_reminder', 'ingest', 'summarize'];

/** claim_scheduler_tasks가 돌려주는 줄(표 전체 칸) */
type Task = TaskRow & { name: string; config: Record<string, number> };

function makeCtx(now: Date, deadline: number, config: Record<string, number>): Ctx {
  const log = (m: string) => console.log(`[scheduler] ${m}`);
  return {
    date: kstDate(now),
    now,
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log, deadline: now.getTime() + AI_HARD_MS })),
    log,
    stats: {},
    force: false,
    windowHours: 72,
    budget: { ...config, deadline: deadline - 15_000 },
  };
}

/** 웹이 넘겨주는 일(파이프라인은 웹 코드를 가져오지 않는다. app/api/cron/scheduler) */
export interface SchedulerHooks {
  /** 기한이 지난 Premium 한 사람을 RevenueCat에서 다시 읽어 플랜을 맞춘다(웹 syncBilling, 이유 renewal_check). 못 읽으면 예외 */
  recheckPremium?: (userId: string) => Promise<void>;
  /** 작업이 실패했을 때(웹은 Sentry로 보낸다). 실패 기록·다시 시도는 여기서 따로 한다 */
  onTaskError?: (task: string, error: unknown) => void;
}

/** 새벽 만료 처리에서 RevenueCat을 다시 읽는 최대 인원. 넘는 사람은 이번엔 내리지 않고 다음 날 본다(화면을 열면 그 자리에서 다시 읽는다) */
const RECHECK_MAX = 50;

/**
 * 기한이 지난 Premium을 Free로 내린다. 내리기 전에 RevenueCat에서 다시 읽어 갱신됐으면 새 기한으로 맞춘다:
 * 갱신 웹훅보다 이 배치가 먼저 돌면 결제한 사람이 Free가 되고, 그 뒤엔 화면도 Premium 기한을 다시 보지 않았다(2026-10-18 점검).
 * 못 읽은 사람과 시간·인원이 모자라 못 본 사람은 이번엔 두고 다음 날 다시 본다(expire_premium p_skip, 마이그레이션 20261018191200).
 * 그동안 배송은 기한으로 Free로 본다(lib/audience.ts effectivePlan)
 */
async function expirePremium(now: Date, deadline: number, hooks: SchedulerHooks): Promise<{ expired: number; rechecked: number; skipped: number }> {
  const skip: string[] = [];
  let rechecked = 0;
  if (hooks.recheckPremium) {
    const due = await selectAll<{ id: string }>((f, t) =>
      db.from('profiles').select('id').eq('plan', 'plus').not('premium_until', 'is', null).lt('premium_until', now.toISOString()).order('premium_until').range(f, t),
    );
    for (const [i, { id }] of due.entries()) {
      // 인원을 넘었거나 남은 시간이 1분 밑이면 다시 읽지 않고 이번엔 두기만 한다
      if (i >= RECHECK_MAX || deadline - Date.now() < 60_000) {
        skip.push(id);
        continue;
      }
      try {
        await hooks.recheckPremium(id);
        rechecked++;
      } catch (e) {
        skip.push(id);
        console.error(`[scheduler] Premium 재확인 실패 ${id.slice(0, 8)}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
    }
  }
  const { data, error } = skip.length ? await db.rpc('expire_premium', { p_skip: skip }) : await db.rpc('expire_premium');
  if (error) console.error('[scheduler] expire_premium', error.message);
  return { expired: (data as number | null) ?? 0, rechecked, skipped: skip.length };
}

/** 작업 결과. unfinished면 다 못 해서 놓아줘 다음 실행이 잇는다 */
type TaskOutcome = { stats: Record<string, unknown>; unfinished?: boolean };

async function runTask(task: Task, now: Date, deadline: number, hooks: SchedulerHooks): Promise<TaskOutcome> {
  if (task.name === 'daily') {
    const premium = await expirePremium(now, deadline, hooks);
    // 보관 기간(가장 긴 플랜, Premium 6개월)이 지난 피드·읽음·플레이리스트 정리(마이그레이션 20261026170000). 피드가 빠진 뒤에 벡터·행을 정리한다
    const archive = check(await db.rpc('prune_archive'), 'prune_archive');
    // 오래된 벡터·행 정리(무료 DB 500MB 안에 머물게, 마이그레이션 20261017150000)
    const pruned = check(await db.rpc('prune_storage'), 'prune_storage');
    return { stats: { ...premium, archive, pruned } };
  }
  if (task.name === 'trial_reminder') return remindTrialEnding(now, deadline);
  const ctx = makeCtx(now, deadline, task.config);
  try {
    if (task.name === 'ingest') {
      await collect(ctx);
      await embed(ctx);
      await cluster(ctx);
      await tag(ctx);
      // 배송이 그사이 만든 요약으로 같은 소식 묶음을 합친다(요약 임베딩이 드는 몇 건만)
      await dedupe(ctx);
    } else if (task.name === 'summarize') {
      await summarize(ctx);
      await dedupe(ctx);
    } else {
      throw new Error(`모르는 작업: ${task.name}`);
    }
    return { stats: ctx.stats };
  } finally {
    await flushUsage();
  }
}

/** 성공: 다음 차례는 finish_scheduler_task가 정한다. 실패 뒤 다시 시도하던 중이었으면 원래 시각(06:00 등)에 맞춰 되돌린다 */
async function finishOk(task: Task, stats: Record<string, unknown>) {
  const next = afterTaskSuccess(task, new Date());
  const { error } = next
    ? await db
        .from('scheduler_tasks')
        .update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'ok', last_error: null, last_stats: stats, next_run_at: next.toISOString() })
        .eq('name', task.name)
    : await db.rpc('finish_scheduler_task', { p_name: task.name, p_status: 'ok', p_error: null, p_stats: stats });
  // 일은 끝났으니 기록 실패로 다시 돌리지 않는다(잠금은 10분 뒤 풀려 다시 가져간다)
  if (error) console.error('[scheduler] 성공 기록', error.message);
}

/**
 * 실패: 30분 뒤 다시(하루 세 번까지), 그 뒤엔 원래 차례. 실패 횟수와 원래 시각은 last_stats에 남겨 이어 센다.
 * 다시 할 시각을 돌려준다(더 하지 않으면 null)
 */
async function finishFailed(task: Task, msg: string): Promise<Date | null> {
  const { nextRunAt, state } = afterTaskFailure(task, new Date());
  const { error } = await db
    .from('scheduler_tasks')
    .update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'failed', last_error: msg, last_stats: state, next_run_at: nextRunAt.toISOString() })
    .eq('name', task.name);
  if (error) {
    // 기록이 안 되면 예전처럼 주기만큼 미룬다(잠금은 풀어야 한다)
    console.error('[scheduler] 실패 기록', error.message);
    await db.rpc('finish_scheduler_task', { p_name: task.name, p_status: 'failed', p_error: msg, p_stats: null });
    return null;
  }
  return state.retryAt ? nextRunAt : null;
}

export async function runScheduler(now = new Date(), hooks: SchedulerHooks = {}): Promise<Record<string, string>> {
  const deadline = now.getTime() + BUDGET_MS;
  const claimed = (check(await db.rpc('claim_scheduler_tasks', { p_now: now.toISOString() }), 'claim_scheduler_tasks') ?? []) as Task[];
  claimed.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const out: Record<string, string> = {};
  for (const task of claimed) {
    if (deadline - Date.now() < (MIN_LEFT_MS[task.name] ?? 60_000)) {
      await db.rpc('release_scheduler_task', { p_name: task.name });
      out[task.name] = '다음으로 미룸';
      continue;
    }
    const t0 = Date.now();
    try {
      const { stats, unfinished } = await runTask(task, now, deadline, hooks);
      if (unfinished) {
        // 다 못 했다: 차례 시각을 그대로 두고 놓아줘 다음 실행(5분 뒤)이 잇는다. 못 놓아주면 잠금은 10분 뒤 풀린다
        const { error } = await db.rpc('release_scheduler_task', { p_name: task.name });
        if (error) console.error('[scheduler] 놓아주기', error.message);
        out[task.name] = `다음 실행이 이어서 ${((Date.now() - t0) / 1000).toFixed(0)}초 ${JSON.stringify(stats)}`;
      } else {
        await finishOk(task, stats);
        out[task.name] = `ok ${((Date.now() - t0) / 1000).toFixed(0)}초`;
      }
    } catch (e) {
      // 실행 시간 마감에 걸려 Gemini를 못 불렀거나 끊긴 것(시간이 모자랐을 뿐)이면 실패로 적지 않고 놓아줘 다음 실행(5분 뒤)이 잇는다.
      // 마감 전에 기본 제한(60초)으로 끊긴 건 진짜 느린 것이라 실패로 둔다(30분 뒤 다시)
      if (e instanceof GeminiTimeoutError && Date.now() >= now.getTime() + AI_HARD_MS - GEMINI_MIN_REQUEST_MS) {
        const { error } = await db.rpc('release_scheduler_task', { p_name: task.name });
        if (error) console.error('[scheduler] 놓아주기', error.message);
        out[task.name] = `시간이 모자라 다음 실행이 이어서 ${((Date.now() - t0) / 1000).toFixed(0)}초`;
        continue;
      }
      const msg = String((e as Error).message ?? e).slice(0, 300);
      hooks.onTaskError?.(task.name, e);
      const retryAt = await finishFailed(task, msg);
      out[task.name] = `실패: ${msg.slice(0, 80)}${retryAt ? ` · ${retryAt.toISOString()}에 다시` : ''}`;
    }
  }
  if (claimed.length) console.log('[scheduler]', JSON.stringify(out));
  return out;
}
