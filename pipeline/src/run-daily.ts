import { kstDate } from '@maengo/core/kst';
import { createGeminiAi } from '@maengo/core/gemini';
import { db } from './lib/db';
import { env } from './lib/env';
import { flushUsage, recordUsage, usageSummary } from './lib/usage';
import type { Ctx } from './lib/ctx';
import { collect } from './jobs/collect';
import { embed } from './jobs/embed';
import { cluster } from './jobs/cluster';
import { tag } from './jobs/tag';
import { summarize } from './jobs/summarize';
import { dedupe } from './jobs/dedupe';
import { rank } from './jobs/rank';

// 일일 배치 진입점(PLAN.md 6장). GitHub Actions가 매일 04:00 KST에 돌린다.
//   pnpm --filter @maengo/pipeline daily [--date=2026-10-20] [--only=collect,embed] [--from=summarize] [--force] [--window=72]
// 모든 단계는 이미 한 일을 건너뛰므로 실패하면 --from으로 그 단계부터 다시 돌리면 된다.
// 오디오는 만들지 않는다. 사용자가 듣기를 누를 때 만든다.

const STAGES = { collect, embed, cluster, tag, summarize, dedupe, rank } as const;
type Stage = keyof typeof STAGES;
const ORDER = Object.keys(STAGES) as Stage[];

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : 'true';
}

function stagesToRun(): Stage[] {
  const only = arg('only');
  if (only) return only.split(',').map((s) => s.trim()).filter((s): s is Stage => ORDER.includes(s as Stage));
  const from = arg('from') as Stage | undefined;
  return from && ORDER.includes(from) ? ORDER.slice(ORDER.indexOf(from)) : ORDER;
}

async function main() {
  const started = Date.now();
  const log = (msg: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s] ${msg}`);
  const ctx: Ctx = {
    date: arg('date') ?? kstDate(),
    now: new Date(),
    ai: createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log }),
    log,
    stats: {},
    force: arg('force') === 'true',
    windowHours: Number(arg('window')) || 72,
  };
  const stages = stagesToRun();
  log(`맹고 일일 배치 ${ctx.date} · 단계: ${stages.join(' → ')}${ctx.force ? ' · force' : ''}`);
  const { data: run } = await db.from('pipeline_runs').insert({ date: ctx.date, stats: {} }).select('id').single();

  let error: string | null = null;
  for (const s of stages) {
    try {
      await STAGES[s](ctx);
    } catch (e) {
      error = `${s}: ${String((e as Error).stack ?? e).slice(0, 1500)}`;
      log(`✗ ${error}`);
      break;
    }
  }

  const usage = usageSummary();
  const usd = usage.reduce((n, u) => n + u.usd, 0);
  for (const u of usage) log(`usage ${u.model} ${u.kind}: 호출 ${u.calls} · 입력 ${u.input} · 출력(생각 포함) ${u.output} 토큰 · 추정 $${u.usd.toFixed(4)}`);
  log(`추정 비용 합계 $${usd.toFixed(4)} (무료 등급 키면 실제 청구 0)`);
  await flushUsage();
  if (run) {
    await db
      .from('pipeline_runs')
      .update({ finished_at: new Date().toISOString(), ok: !error, stats: { ...ctx.stats, usage, estUsd: Number(usd.toFixed(4)) }, error })
      .eq('id', run.id);
  }
  log(error ? '실패' : '완료');
  if (error) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
