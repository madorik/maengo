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

type Total = { model: string; kind: UsageEvent['kind']; calls: number; input: number; output: number };

/** 이번 실행 합계(손으로 돌린 배치가 로그·pipeline_runs에 남긴다). flushUsage가 비운다 */
const totals = new Map<string, Total>();
/** 아직 usage_log에 못 쓴 호출 */
let unsaved: Total[] = [];
/** 쓰기는 한 줄로 이어서 한다(동시에 여러 번 쓰지 않게) */
let writing: Promise<void> = Promise.resolve();
/** DB가 계속 실패할 때 쌓아 둘 최대 줄 수 */
const MAX_UNSAVED = 500;

function add(map: Map<string, Total>, t: Total) {
  const key = `${t.model}|${t.kind}`;
  const cur = map.get(key) ?? { model: t.model, kind: t.kind, calls: 0, input: 0, output: 0 };
  cur.calls += t.calls;
  cur.input += t.input;
  cur.output += t.output;
  map.set(key, cur);
}

const usd = (t: Total) => {
  const p = price(t.model);
  return (t.input * p.input + t.output * p.output) / 1e6;
};

/** 밀린 호출을 (모델, 종류)별로 묶어 usage_log에 쓴다. 실패하면 다음에 다시 쓴다(던지지 않는다) */
async function save() {
  if (!unsaved.length) return;
  const batch = new Map<string, Total>();
  for (const t of unsaved.splice(0)) add(batch, t);
  const rows = [...batch.values()].map((t) => ({ provider: 'gemini', kind: t.kind, units: t.input + t.output, est_usd: Number(usd(t).toFixed(4)) }));
  try {
    const { error } = await db.from('usage_log').insert(rows);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('usage_log', String((e as Error).message ?? e).slice(0, 160));
    unsaved = [...batch.values(), ...unsaved].slice(0, MAX_UNSAVED);
  }
}

/**
 * 호출마다 바로 usage_log에 남긴다(2026-10-18). 실행이 끝날 때 한 번에 남기면 동시에 도는 다른 실행(1분 배송·웹 즉석 피드)이
 * 하루 지출 상한(ai-guard)을 확인할 때 이 지출을 못 봐서 상한을 넘길 수 있었다
 */
export function recordUsage(e: UsageEvent) {
  const t: Total = { model: e.model, kind: e.kind, calls: 1, input: e.inputTokens, output: e.outputTokens + e.thinkingTokens };
  add(totals, t);
  unsaved.push(t);
  writing = writing.then(save);
}

export function usageSummary() {
  return [...totals.values()].map((t) => ({ ...t, usd: usd(t) }));
}

/** 실행이 끝날 때: 아직 못 쓴 호출을 마저 쓰고 이번 실행 합계를 비운다 */
export async function flushUsage() {
  writing = writing.then(save);
  await writing;
  totals.clear();
}
