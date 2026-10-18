import { packAmount, PREMIUM_ENTITLEMENT, PREMIUM_PRODUCT } from '@maengo/core/plans';

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
  purchase_date?: string;
  price?: { amount: number; currency: string } | null;
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

// ---- 결제 기록(purchases 표, record_purchases) ----

/** purchases 한 줄(record_purchases에 넘기는 모양) */
export interface PaymentRow {
  user_id: string;
  store: string;
  transaction_id: string;
  original_transaction_id: string | null;
  rc_id: string | null;
  product_id: string;
  kind: 'subscription' | 'pack' | 'other';
  purchased_at: string | null;
  expires_at: string | null;
  price: number | null;
  currency: string | null;
  price_usd: number | null;
  sandbox: boolean;
  refunded_at: string | null;
  source: string;
}

const kindOf = (productId: string): PaymentRow['kind'] => (sameProduct(productId, PREMIUM_PRODUCT) ? 'subscription' : packAmount(productId) ? 'pack' : 'other');
/** RevenueCat 스토어 이름을 소문자로(구독자 응답은 app_store, 웹훅은 APP_STORE) */
const storeName = (store: string | null | undefined) => (store ?? 'unknown').toLowerCase();
const isoOf = (ms: number | null | undefined) => (typeof ms === 'number' ? new Date(ms).toISOString() : null);

/** 구독자 응답에 든 거래들. 구독은 지금 기간의 거래 하나(갱신마다 바뀐다), 맹고 묶음은 산 것 전부 */
export function paymentsFromSubscriber(sub: RcSubscriber, userId: string): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const [productId, s] of Object.entries(sub.subscriptions ?? {})) {
    rows.push({
      user_id: userId,
      store: storeName(s.store),
      transaction_id: s.store_transaction_id ?? `${productId}@${s.purchase_date ?? s.original_purchase_date ?? ''}`,
      original_transaction_id: null,
      rc_id: null,
      product_id: productId,
      kind: kindOf(productId),
      purchased_at: s.purchase_date ?? null,
      expires_at: s.expires_date,
      price: s.price?.amount ?? null,
      currency: s.price?.currency ?? null,
      price_usd: null,
      sandbox: !!s.is_sandbox,
      refunded_at: s.refunded_at ?? null,
      source: 'sync',
    });
  }
  for (const [productId, list] of Object.entries(sub.non_subscriptions ?? {})) {
    for (const p of list) {
      rows.push({
        user_id: userId,
        store: storeName(p.store),
        transaction_id: p.store_transaction_id ?? p.id,
        original_transaction_id: null,
        rc_id: p.id,
        product_id: productId,
        kind: kindOf(productId),
        purchased_at: p.purchase_date ?? null,
        expires_at: null,
        price: null,
        currency: null,
        price_usd: null,
        sandbox: !!p.is_sandbox,
        refunded_at: null,
        source: 'sync',
      });
    }
  }
  return rows;
}

/** RevenueCat 웹훅 이벤트(필요한 칸만) */
export interface RcEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_to?: string[];
  product_id?: string;
  store?: string;
  environment?: string;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  price?: number | null;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
}

/** 돈이 오간 이벤트(첫 구매·갱신·묶음 구매·상품 변경). 해지·만료·환불은 구독자 응답(refunded_at)과 billing_events로 남는다 */
const PAID = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'PRODUCT_CHANGE']);

export function paymentFromEvent(e: RcEvent, userId: string): PaymentRow | null {
  if (!e.type || !PAID.has(e.type) || !e.transaction_id || !e.product_id) return null;
  return {
    user_id: userId,
    store: storeName(e.store),
    transaction_id: e.transaction_id,
    original_transaction_id: e.original_transaction_id ?? null,
    rc_id: null,
    product_id: e.product_id,
    kind: kindOf(e.product_id),
    purchased_at: isoOf(e.purchased_at_ms),
    expires_at: isoOf(e.expiration_at_ms),
    price: e.price_in_purchased_currency ?? null,
    currency: e.currency ?? null,
    price_usd: e.price ?? null,
    sandbox: e.environment === 'SANDBOX',
    refunded_at: null,
    source: `webhook:${e.type}`,
  };
}
