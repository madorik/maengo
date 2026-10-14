import type { UsageEvent } from '@maengo/core/ai';
import { db } from './db';

// 모델별 100만 토큰당 달러(추정치, 2026-10-14 https://ai.google.dev/gemini-api/docs/pricing). 생각 토큰은 출력 요금으로 센다.
// 쓰는 모델은 core/ai/models.ts의 고정 버전뿐이다. 모르는 모델은 비싼 쪽(Flash)으로 센다
const PRICES: Record<string, { input: number; output: number }> = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
};

function price(model: string): { input: number; output: number } {
  const id = Object.keys(PRICES).find((k) => model.startsWith(k));
  return id ? PRICES[id]! : { input: 0.75, output: 3.75 };
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
