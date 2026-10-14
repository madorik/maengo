import 'server-only';
import { PLAN_COLUMNS, planFromRow, type PlanLimits, type PlanRow } from '@maengo/core/plans';
import type { Plan } from '@maengo/core/types';
import { db, must } from './db';

// 플랜별 값(DB plans 표). 표를 고치면 1분 안에 반영된다(서버마다 1분 캐시).

const TTL_MS = 60_000;
let cache: { at: number; plans: Map<Plan, PlanLimits> } | null = null;

export async function getPlans(): Promise<Map<Plan, PlanLimits>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.plans;
  const rows = must(await db.from('plans').select(PLAN_COLUMNS), 'plans') as unknown as PlanRow[];
  const plans = new Map(rows.map((r) => [r.id, planFromRow(r)]));
  if (!plans.has('free') || !plans.has('plus')) throw new Error('plans 표에 free·plus가 없어요');
  cache = { at: Date.now(), plans };
  return plans;
}

export async function planLimits(plan: Plan): Promise<PlanLimits> {
  return (await getPlans()).get(plan)!;
}

/** '월 5,900원' */
export const monthlyPrice = (p: PlanLimits) => `월 ${p.priceKrw.toLocaleString('ko-KR')}원`;
