import type { UsageEvent } from '@maengo/core/ai';
import { db } from './db';

// 모델별 100만 토큰당 달러(추정치). 무료 등급 키로 돌리면 실제 청구는 0이다.
// 생각 토큰은 출력 요금으로 센다. 결제를 켜면 https://ai.google.dev/pricing 값으로 맞춘다.
function price(model: string): { input: number; output: number } {
  if (model.includes('embedding')) return { input: 0.15, output: 0 };
  if (model.includes('flash-lite')) return { input: 0.1, output: 0.4 };
  if (model.includes('flash')) return { input: 0.3, output: 2.5 };
  if (model.includes('pro')) return { input: 1.25, output: 10 };
  return { input: 0.3, output: 2.5 };
}

const totals = new Map<string, { model: string; kind: UsageEvent['kind']; calls: number; input: number; output: number }>();

export function recordUsage(e: UsageEvent) {
  const key = `${e.model}|${e.kind}`;
  const t = totals.get(key) ?? { model: e.model, kind: e.kind, calls: 0, input: 0, output: 0 };
  t.calls++;
  t.input += e.inputTokens;
  t.output += e.outputTokens + e.thinkingTokens;
  totals.set(key, t);
}

export function usageSummary() {
  return [...totals.values()].map((t) => {
    const p = price(t.model);
    return { ...t, usd: (t.input * p.input + t.output * p.output) / 1e6 };
  });
}

/** 실행이 끝날 때 (모델, 종류)별로 한 줄씩 usage_log에 남긴다 */
export async function flushUsage() {
  const rows = usageSummary().map((t) => ({
    provider: 'gemini',
    kind: t.kind,
    units: t.input + t.output,
    est_usd: Number(t.usd.toFixed(4)),
  }));
  if (rows.length) await db.from('usage_log').insert(rows);
  totals.clear();
}
