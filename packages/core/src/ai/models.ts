import type { Plan, Tier } from '../types';

// Free는 Gemini Flash, Premium은 상위 모델. 모델 ID는 env로만 바꾼다.
// 기본값은 Gemini API의 최신 별칭이다. 실제 키를 넣는 날 고정 버전으로 바꿀지 정한다(API_KEYS.md).
export const DEFAULT_MODELS: Record<Tier, string> = {
  basic: 'gemini-flash-latest',
  pro: 'gemini-pro-latest',
};

export function tierOf(plan: Plan): Tier {
  return plan === 'free' ? 'basic' : 'pro';
}

type Env = Record<string, string | undefined>;

export function modelFor(tier: Tier, env: Env = process.env): string {
  const fromEnv = tier === 'pro' ? env.GEMINI_MODEL_PLUS : env.GEMINI_MODEL_FREE;
  return fromEnv?.trim() || DEFAULT_MODELS[tier];
}

export function modelForPlan(plan: Plan, env: Env = process.env): string {
  return modelFor(tierOf(plan), env);
}
