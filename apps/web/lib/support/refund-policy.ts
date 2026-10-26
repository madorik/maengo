import { addDays, kstDate } from '@maengo/core/kst';
import { packAmount } from '@maengo/core/plans';

// 환불 판정(2026-10-26, 맹고-문서/환불과-구매-복원.md). 순수 함수라 서버(문의 챗봇·스토어 환불 의견)와 테스트가 같이 쓴다.
// 전자상거래법 17조 1항: 결제한 날부터 7일 안에는 청약철회(환불)할 수 있다. 2항 5호: 쓰기 시작한 디지털 콘텐츠는 제한된다.
// - Premium 구독: 그 결제 뒤 Premium에서만 되는 것(Free 하루 소식보다 더 받은 소식 읽기, Free 몫을 넘는 음성, 플레이리스트)을 썼으면 환불하지 않는다.
//   Free로도 되는 것(하루 소식 3개 읽기, 하루 음성 1개)은 세지 않는다. 무료 체험 동안 쓴 것도 세지 않는다(결제 전 시험 사용).
// - 맹고 묶음: 나눠 쓰는 콘텐츠라 쓴 맹고만 제한된다(공정위 의결 2019-160 카카오뮤직 '곡 구매'). 남은 맹고는 7일 안에 환불한다.
//   지갑에서 쓴 맹고는 구매한 맹고에서 먼저, 먼저 산 것부터 쓴 것으로 본다(가입 선물·운영 지급 맹고는 구매한 맹고를 다 쓴 뒤에, packLots).

export const REFUND_DAYS = 7;
/** 애플·구글이 환불 요청을 받는 기간(대략). 스토어 환불 의견은 이 안의 결제만 본다 */
export const STORE_REFUND_LOOKBACK_DAYS = 90;

export interface PurchaseFacts {
  id: number;
  /** purchases.store: app_store | play_store | test_store | promotional … */
  store: string;
  productId: string;
  kind: 'subscription' | 'pack' | 'other';
  /** trial(무료 체험) | intro | normal, 구독만 */
  periodType: string | null;
  purchasedAt: string;
  price: number | null;
  currency: string | null;
  refundedAt: string | null;
  sandbox: boolean;
}

/** 결제 뒤 Premium에서만 되는 것을 쓴 기록. at은 처음 쓴 시각 */
export interface PremiumUse {
  kind: 'premium_read' | 'extra_listen' | 'playlist';
  at: string;
  count: number;
}

export type RefundVerdict =
  | { ok: true; scope: 'full'; amount: number | null }
  /** 맹고 묶음 일부만(쓴 맹고 빼고). amount는 남은 비율만큼(원 밑은 버림) */
  | { ok: true; scope: 'partial'; units: number; total: number; amount: number | null }
  | { ok: false; reason: 'refunded' | 'trial' | 'not_store' | 'unknown_product' }
  | { ok: false; reason: 'expired'; deadline: string }
  | { ok: false; reason: 'used'; uses: PremiumUse[] }
  | { ok: false; reason: 'spent'; spent: number; total: number };

/** 환불할 수 있는 마지막 순간: 결제한 날(한국 시간)부터 7일째 되는 날 끝(첫날은 세지 않는다, 민법 157조) */
export function refundDeadline(purchasedAt: string): string {
  const last = addDays(kstDate(new Date(purchasedAt)), REFUND_DAYS);
  return new Date(`${last}T23:59:59.999+09:00`).toISOString();
}

/** 실제 스토어 결제인지(운영자가 준 권한·RevenueCat 시험 결제는 환불할 돈이 없다. 샌드박스는 시험용으로 판정만 한다) */
const isStorePurchase = (p: PurchaseFacts) => p.store === 'app_store' || p.store === 'play_store' || p.store === 'test_store';

function common(p: PurchaseFacts, now: Date): RefundVerdict | null {
  if (p.refundedAt) return { ok: false, reason: 'refunded' };
  if (!isStorePurchase(p)) return { ok: false, reason: 'not_store' };
  const deadline = refundDeadline(p.purchasedAt);
  if (now.getTime() > Date.parse(deadline)) return { ok: false, reason: 'expired', deadline };
  return null;
}

/** Premium 구독 결제 하나. uses = 그 결제 시각 뒤에 Premium에서만 되는 것을 쓴 기록 */
export function judgeSubscription(p: PurchaseFacts, uses: PremiumUse[], now: Date): RefundVerdict {
  // 체험 시작 거래는 돈이 오가지 않았다(체험 중 해지하면 결제되지 않는다)
  if (p.periodType === 'trial' && !p.refundedAt) return { ok: false, reason: 'trial' };
  const c = common(p, now);
  if (c) return c;
  if (uses.length) return { ok: false, reason: 'used', uses };
  return { ok: true, scope: 'full', amount: p.price };
}

/** 지갑 기록 한 줄(wallet_ledger, 시각 순서대로) */
export interface LedgerRow {
  reason: 'signup' | 'purchase' | 'more' | 'refund' | 'admin' | 'chargeback';
  delta: number;
  ref: string | null;
}

/**
 * 구매 묶음마다 아직 안 쓴 맹고(ref 'rc:거래' → 남은 수). 지갑 기록을 처음부터 따라가며 쓴 맹고(more)를 구매한 맹고에서 먼저,
 * 먼저 산 것부터 뺀다. 구매한 맹고가 없을 때 쓴 것은 가입 선물·운영 지급에서 쓴 것이다. 받지 못해 되돌려 받은 맹고(refund, 쓴 것과 같은 ref)는
 * 뺐던 묶음에 돌려놓고, 환불 회수(chargeback)된 묶음은 0으로 둔다
 */
export function packLots(ledger: LedgerRow[]): Map<string, number> {
  const lots = new Map<string, number>();
  const taken = new Map<string, { lot: string; n: number }[]>();
  for (const r of ledger) {
    if (r.reason === 'purchase' && r.ref && r.delta > 0) lots.set(r.ref, (lots.get(r.ref) ?? 0) + r.delta);
    else if (r.reason === 'more' && r.delta < 0) {
      let need = -r.delta;
      const from: { lot: string; n: number }[] = [];
      for (const [lot, left] of lots) {
        if (need <= 0) break;
        const n = Math.min(left, need);
        if (n <= 0) continue;
        lots.set(lot, left - n);
        from.push({ lot, n });
        need -= n;
      }
      if (r.ref) taken.set(r.ref, from);
    } else if (r.reason === 'refund' && r.ref) {
      for (const { lot, n } of taken.get(r.ref) ?? []) lots.set(lot, (lots.get(lot) ?? 0) + n);
      taken.delete(r.ref);
    } else if (r.reason === 'chargeback' && r.ref && lots.has(r.ref)) lots.set(r.ref, 0);
  }
  return lots;
}

/** 맹고 묶음 하나. left = 그 묶음에서 아직 안 쓴 맹고(packLots), balance = 지금 지갑 잔액 */
export function judgePack(p: PurchaseFacts, left: number, balance: number, now: Date): RefundVerdict {
  const total = packAmount(p.productId);
  if (!total) return { ok: false, reason: 'unknown_product' };
  const c = common(p, now);
  if (c) return c;
  const units = Math.min(Math.max(0, left), total, Math.max(0, balance));
  if (units <= 0) return { ok: false, reason: 'spent', spent: total - Math.max(0, Math.min(left, total)), total };
  if (units >= total) return { ok: true, scope: 'full', amount: p.price };
  return { ok: true, scope: 'partial', units, total, amount: p.price === null ? null : Math.floor((p.price * units) / total) };
}

/**
 * 환불을 누가 하는지. play: 맹고가 RevenueCat으로 바로 환불(전액만 된다) | apple: 애플이 정한다(회원이 애플에 요청) |
 * operator: 구글 결제의 일부 환불(Play Console에서 운영자가) | test: 시험 결제(판정만) | none: 환불 대상 아님
 */
export type RefundRoute = 'play' | 'apple' | 'operator' | 'test' | 'none';

export function refundRoute(p: PurchaseFacts, v: RefundVerdict): RefundRoute {
  if (!v.ok) return 'none';
  if (p.store === 'test_store' || p.sandbox) return 'test';
  if (p.store === 'app_store') return 'apple';
  if (p.store === 'play_store') return v.scope === 'full' ? 'play' : 'operator';
  return 'none';
}

/**
 * 애플·구글이 환불 요청을 받았을 때 RevenueCat이 보낼 의견(회원 하나에 하나). 최근 90일 안의 실제 결제(환불 안 됨)를 모두 본다:
 * 모두 전액 환불 대상이면 grant, 하나도 대상이 아니면 decline(썼거나 7일 지남), 섞였거나 일부 환불이면 neutral(스토어가 정함).
 * 스토어 결제가 없으면 null(보낼 것 없음)
 */
export function refundPreference(cases: { purchase: PurchaseFacts; verdict: RefundVerdict }[], now: Date): 'grant' | 'decline' | 'neutral' | null {
  const since = now.getTime() - STORE_REFUND_LOOKBACK_DAYS * 86_400_000;
  const live = cases.filter(
    (c) => (c.purchase.store === 'app_store' || c.purchase.store === 'play_store') && !c.purchase.refundedAt && Date.parse(c.purchase.purchasedAt) >= since && !(c.verdict.ok === false && c.verdict.reason === 'trial'),
  );
  if (!live.length) return null;
  const full = live.filter((c) => c.verdict.ok && c.verdict.scope === 'full').length;
  if (full === live.length) return 'grant';
  if (live.every((c) => !c.verdict.ok)) return 'decline';
  return 'neutral';
}
