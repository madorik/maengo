import { packAmount, PREMIUM_ENTITLEMENT } from '@maengo/core/plans';

// RevenueCat REST v1 GET /subscribers/{app_user_id}의 subscriber를 우리 상태로 읽는다(순수 함수, 서버·테스트 공용).
// 웹훅 내용은 믿지 않고 신호로만 쓰고, 늘 이 응답으로 맞춘다(순서가 뒤바뀌거나 두 번 와도 결과가 같다).

export type BillingStore = 'app_store' | 'play' | 'promotional';

export interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date?: string;
}

export interface RcSubscription {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  store: string;
  store_transaction_id?: string | null;
  original_purchase_date?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
  is_sandbox?: boolean;
}

export interface RcNonSubscription {
  id: string;
  store?: string;
  store_transaction_id?: string | null;
  purchase_date?: string;
  is_sandbox?: boolean;
}

export interface RcSubscriber {
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
  non_subscriptions?: Record<string, RcNonSubscription[]>;
  management_url?: string | null;
}

export interface PremiumState {
  active: boolean;
  /** 이때까지 Premium(유예 기간 포함). null이면 기한 없음(운영자가 준 평생 권한 등) */
  until: string | null;
  productId: string;
  store: BillingStore;
  /** 다음 갱신을 끔(기간이 끝나면 Free) */
  cancelAtPeriodEnd: boolean;
  /** 갱신 결제가 실패해 스토어가 다시 시도하는 중 */
  billingIssue: boolean;
  /** 스토어 원거래 ID(subscriptions.store_ref) */
  ref: string | null;
}

export interface BillingState {
  /** null이면 Premium을 산 적이 없다 */
  premium: PremiumState | null;
  /** 추가 구매한 맹고. ref는 거래마다 하나라 같은 묶음을 두 번 넣지 않는다 */
  packs: { ref: string; productId: string; amount: number }[];
}

export function storeOf(store: string | undefined): BillingStore {
  if (store === 'app_store' || store === 'mac_app_store') return 'app_store';
  if (store === 'play_store') return 'play';
  return 'promotional';
}

const later = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

/** 플레이 구독은 'id:기본요금제'로 와서 앞부분으로 맞춘다 */
const sameProduct = (a: string, b: string) => a === b || a.split(':')[0] === b.split(':')[0];

export function readSubscriber(sub: RcSubscriber, now: Date): BillingState {
  let premium: PremiumState | null = null;
  const ent = sub.entitlements?.[PREMIUM_ENTITLEMENT];
  if (ent) {
    const entry = Object.entries(sub.subscriptions ?? {}).find(([id]) => sameProduct(id, ent.product_identifier));
    const s = entry?.[1];
    const until = ent.expires_date === null ? null : later(ent.expires_date, ent.grace_period_expires_date);
    premium = {
      active: until === null || Date.parse(until) > now.getTime(),
      until,
      productId: ent.product_identifier,
      store: storeOf(s?.store),
      cancelAtPeriodEnd: !!s?.unsubscribe_detected_at,
      billingIssue: !!s?.billing_issues_detected_at,
      ref: s?.store_transaction_id ?? null,
    };
  }
  const packs: BillingState['packs'] = [];
  for (const [productId, list] of Object.entries(sub.non_subscriptions ?? {})) {
    const amount = packAmount(productId);
    if (!amount) continue;
    for (const p of list) packs.push({ ref: `rc:${p.id}`, productId, amount });
  }
  return { premium, packs };
}
