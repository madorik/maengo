import type { Plan } from './types';

// 플랜별 한도 중 웹과 새벽 배치가 함께 쓰는 것. 여기 한 곳에서만 정한다.

/**
 * 베타 기간(결제를 받기 전, 2026-10-10~): 모든 회원이 기한 없는 Premium이고 로고 옆에 Beta를 단다.
 * 정식 출시 때 false로 바꾸고, 가입 트리거·기존 회원 플랜(supabase/migrations/…_beta_all_premium.sql)과 이용약관 6조를 다시 정한다.
 */
export const BETA = true;

/** 하루에 받는 맹고 수. Free 1개, Premium 10개. 베타 동안은 Premium도 5개 */
export function dailyItemsFor(plan: Plan): number {
  if (plan === 'free') return 1;
  return BETA ? 5 : 10;
}
