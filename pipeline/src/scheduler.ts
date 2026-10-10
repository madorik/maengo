import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { runDeliveries } from './deliveries';
import { cluster } from './jobs/cluster';
import { collect } from './jobs/collect';
import { dedupe } from './jobs/dedupe';
import { embed } from './jobs/embed';
import { summarize } from './jobs/summarize';
import { tag } from './jobs/tag';
import type { Ctx } from './lib/ctx';
import { check, db } from './lib/db';
import { env } from './lib/env';
import { flushUsage, recordUsage } from './lib/usage';

// 서버 스케줄러(Supabase pg_cron이 5분마다 웹 /api/cron/scheduler를 부른다).
// 무엇을 언제 돌릴지는 scheduler_tasks 표가 정한다: 차례가 된 작업만 가져와 돌리고, 결과와 다음 차례를 표에 남긴다.
// Vercel 함수는 300초까지라 한 번에 약 4분 예산을 두고, 다 못 한 작업은 놓아줘 다음 실행이 이어받는다.

/** 이 시각까지만 새 작업을 시작한다(시작 후 4분) */
const BUDGET_MS = 240_000;
/** 작업마다 최소 이만큼은 남아 있어야 시작한다(수집은 출처 79곳에 약 10초, 임베딩은 300개에 수십 초) */
const MIN_LEFT_MS: Record<string, number> = { deliveries: 0, daily: 0, ingest: 60_000, summarize: 60_000 };
/** 알림이 늦지 않게 deliveries를 먼저, 무거운 요약은 마지막에 */
const ORDER = ['deliveries', 'daily', 'ingest', 'summarize'];

type Task = { name: string; config: Record<string, number> };

function makeCtx(now: Date, deadline: number, config: Record<string, number>): Ctx {
  const log = (m: string) => console.log(`[scheduler] ${m}`);
  return {
    date: kstDate(now),
    now,
    ai: createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log }),
    log,
    stats: {},
    force: false,
    windowHours: 72,
    budget: { ...config, deadline: deadline - 15_000 },
  };
}

async function runTask(task: Task, now: Date, deadline: number): Promise<Record<string, unknown>> {
  if (task.name === 'deliveries') return { ...(await runDeliveries(now)) };
  if (task.name === 'daily') {
    const { data } = await db.rpc('expire_premium');
    return { expired: data ?? 0 };
  }
  const ctx = makeCtx(now, deadline, task.config);
  try {
    if (task.name === 'ingest') {
      await collect(ctx);
      await embed(ctx);
      await cluster(ctx);
      await tag(ctx);
    } else if (task.name === 'summarize') {
      await summarize(ctx);
      await dedupe(ctx);
    } else {
      throw new Error(`모르는 작업: ${task.name}`);
    }
    return ctx.stats;
  } finally {
    await flushUsage();
  }
}

export async function runScheduler(now = new Date()): Promise<Record<string, string>> {
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
      const stats = await runTask(task, now, deadline);
      await db.rpc('finish_scheduler_task', { p_name: task.name, p_status: 'ok', p_error: null, p_stats: stats });
      out[task.name] = `ok ${((Date.now() - t0) / 1000).toFixed(0)}초`;
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 300);
      await db.rpc('finish_scheduler_task', { p_name: task.name, p_status: 'failed', p_error: msg, p_stats: null });
      out[task.name] = `실패: ${msg.slice(0, 80)}`;
    }
  }
  if (claimed.length) console.log('[scheduler]', JSON.stringify(out));
  return out;
}
