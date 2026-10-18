// 결제 안내 띠(오늘 화면 맨 위·설정 > 플랜, components/premium/BillingBanner.tsx)를 띄울지 정한다(순수 함수, 서버·테스트 공용).
// - trial_ending: 무료 체험이 이틀 안에 끝나 자동 결제된다(해지 예약했으면 띄우지 않는다). 푸시 알림은 따로(pipeline trial-reminder)
// - past_due: 갱신 결제가 실패해 스토어가 다시 시도하는 중(유예 기간). 결제 수단을 확인하게 한다

/** 체험이 끝나기 이만큼 전부터 알린다(1~2일 전) */
export const TRIAL_NOTICE_MS = 2 * 86_400_000;

export interface SubscriptionLike {
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  store?: string;
}

export type BillingNotice = { kind: 'trial_ending'; endsAt: string; store?: string } | { kind: 'past_due'; store?: string };

export function billingNoticeOf(sub: SubscriptionLike | null, now: Date = new Date()): BillingNotice | null {
  if (!sub) return null;
  if (sub.status === 'past_due') return { kind: 'past_due', store: sub.store };
  if (sub.status !== 'trial' || sub.cancelAtPeriodEnd) return null;
  const left = Date.parse(sub.periodEnd) - now.getTime();
  return left > 0 && left <= TRIAL_NOTICE_MS ? { kind: 'trial_ending', endsAt: sub.periodEnd, store: sub.store } : null;
}
