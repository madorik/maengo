import { PLAN_COLUMNS, planFromRow, type PlanLimits, type PlanRow } from '@maengo/core/plans';
import type { Plan } from '@maengo/core/types';
import { check, db } from './db';

// 플랜별 값(DB plans 표). 표를 고치면 1분 안에 반영된다(서버마다 1분 캐시). 웹은 apps/web/lib/server/plans.ts

const TTL_MS = 60_000;
let cache: { at: number; plans: Map<Plan, PlanLimits> } | null = null;

export async function getPlans(): Promise<Map<Plan, PlanLimits>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.plans;
  const rows = check(await db.from('plans').select(PLAN_COLUMNS), 'plans') as unknown as PlanRow[];
  const plans = new Map(rows.map((r) => [r.id, planFromRow(r)]));
  if (!plans.has('free') || !plans.has('plus')) throw new Error('plans 표에 free·plus가 없어요');
  cache = { at: Date.now(), plans };
  return plans;
}
