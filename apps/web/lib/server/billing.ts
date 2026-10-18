import 'server-only';
import { packRefund, paymentFromEvent, paymentsFromSubscriber, readSubscriber, refundFromEvent, type BillingStore, type PaymentRow, type RcEvent, type RcSubscriber } from '../billing/revenuecat';
import { db, must } from './db';
import { chargebackMaengo, creditMaengo } from './wallet';

// 인앱 결제(RevenueCat). app_user_id = Supabase 회원 id. 앱이 결제를 마치거나 RevenueCat 웹훅이 오면
// RevenueCat에서 그 사람 상태를 다시 읽어 플랜(profiles)·구독(subscriptions)·추가 구매한 맹고(지갑)를 맞춘다. apps/mobile/BILLING.md

const API = 'https://api.revenuecat.com/v1';

export const billingConfigured = () => !!process.env.REVENUECAT_SECRET_KEY?.trim();

async function fetchSubscriber(userId: string): Promise<RcSubscriber> {
  const key = process.env.REVENUECAT_SECRET_KEY?.trim();
  if (!key) throw new Error('REVENUECAT_SECRET_KEY가 없어요');
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { subscriber: RcSubscriber }).subscriber;
}

export interface BillingSyncResult {
  plan: 'free' | 'plus' | 'unchanged';
  /** 이번에 새로 넣은 추가 구매한 맹고 */
  credited: number;
}

/** 결제 기록(purchases)에 넣는다. 기록이 실패해도 플랜·지갑 맞추기는 계속한다 */
export async function recordPayments(rows: PaymentRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db.rpc('record_purchases', { p: rows });
  if (error) console.error('[billing] 결제 기록 실패', error.message);
}

/**
 * RevenueCat 웹훅 원본(billing_events)과, 돈이 오간 이벤트면 그 거래(purchases)를 남긴다. 같은 이벤트가 다시 와도 한 줄.
 * userId가 우리 회원이 아니면(지운 회원 등) 회원 연결 없이 원본만 남긴다. 실패해도 웹훅 처리는 계속한다
 */
export async function recordBillingEvent(e: RcEvent & Record<string, unknown>, userId: string | null): Promise<void> {
  const row = {
    id: e.id ?? `${e.type ?? 'UNKNOWN'}:${e.event_timestamp_ms ?? Date.now()}:${e.transaction_id ?? ''}`,
    user_id: userId,
    app_user_id: e.app_user_id ?? null,
    type: e.type ?? 'UNKNOWN',
    product_id: e.product_id ?? null,
    store: e.store ? e.store.toLowerCase() : null,
    environment: e.environment ?? null,
    transaction_id: e.transaction_id ?? null,
    event_at: typeof e.event_timestamp_ms === 'number' ? new Date(e.event_timestamp_ms).toISOString() : null,
    payload: e,
  };
  let { error } = await db.from('billing_events').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  if (error?.code === '23503') ({ error } = await db.from('billing_events').upsert({ ...row, user_id: null }, { onConflict: 'id', ignoreDuplicates: true }));
  if (error) console.error('[billing] 웹훅 원본 기록 실패', e.type, error.message);
  // 돈이 오간 거래, 또는 환불된 거래(환불 시각)
  const pay = userId ? (paymentFromEvent(e, userId) ?? refundFromEvent(e, userId)) : null;
  if (pay) await recordPayments([pay]);
}

/**
 * 맹고 묶음 환불(웹훅 CANCELLATION, 구글 무효 구매 포함): 그 거래로 넣은 맹고를 받은 회원에게서 한 번 뺀다(잔액까지만).
 * 웹훅은 스토어 거래 ID만 줘서 그것으로 찾고, 예전 지갑 기록(스토어 거래가 비어 있음)을 위해 purchases에서 RevenueCat 거래 ID(ref)도 찾아 넘긴다.
 * 묶음 환불이 아니면 아무것도 안 한다. 실패하면 예외(웹훅이 500으로 답해 RevenueCat이 다시 보낸다. 같은 거래는 한 번만 뺀다)
 */
export async function clawbackRefund(e: RcEvent, userId: string | null): Promise<number | null> {
  const refund = packRefund(e);
  if (!refund || !userId) return null;
  const { data } = await db.from('purchases').select('rc_id').eq('transaction_id', refund.transactionId).not('rc_id', 'is', null).limit(1).maybeSingle();
  const rcId = (data as { rc_id: string } | null)?.rc_id ?? null;
  const taken = await chargebackMaengo(userId, refund.storeTx, rcId ? `rc:${rcId}` : null);
  if (taken !== null) console.log(`[billing] 맹고 묶음 환불 회수 ${refund.productId} ${taken}/${refund.amount}맹고`);
  return taken;
}

/**
 * reason은 플랜이 바뀌면 plan_changes에 남는 이유: app_sync(앱이 결제·복원 직후), webhook:이벤트, renewal_check(만료 직전 재확인)
 */
export async function syncBilling(userId: string, reason: string): Promise<BillingSyncResult> {
  const exists = must(await db.from('profiles').select('id').eq('id', userId).maybeSingle(), 'profiles') as { id: string } | null;
  if (!exists) return { plan: 'unchanged', credited: 0 };
  const sub = await fetchSubscriber(userId);
  const state = readSubscriber(sub, new Date());
  await recordPayments(paymentsFromSubscriber(sub, userId));
  let plan: BillingSyncResult['plan'] = 'unchanged';

  if (!state.premium && (await dropMovedSubscription(userId, reason))) plan = 'free';
  if (state.premium) {
    const p = state.premium;
    if (p.active) {
      must(await db.rpc('set_plan', { p_user: userId, p_plan: 'plus', p_until: p.until, p_reason: reason }), 'set_plan plus');
      plan = 'plus';
    } else {
      must(await db.rpc('set_plan', { p_user: userId, p_plan: 'free', p_until: null, p_reason: reason, p_only_if: 'plus' }), 'set_plan free');
      plan = 'free';
    }
    must(
      await db.from('subscriptions').upsert(
        {
          user_id: userId,
          store: p.store,
          store_ref: p.ref,
          status: !p.active ? 'canceled' : p.trial ? 'trial' : p.billingIssue ? 'past_due' : 'active',
          current_period_end: p.until ?? '9999-12-31T00:00:00Z',
          cancel_at_period_end: p.cancelAtPeriodEnd,
        },
        { onConflict: 'user_id' },
      ),
      'subscriptions upsert',
    );
  }

  let credited = 0;
  for (const pack of state.packs) if (await creditMaengo(userId, pack.amount, pack.ref, pack.storeTx)) credited += pack.amount;
  return { plan, credited };
}

/**
 * RevenueCat에 Premium 권한이 아예 없는데(구매가 다른 회원에게 옮겨 갔거나 RevenueCat에서 지움) 우리 쪽은 스토어 구독으로 Premium인 사람을 Free로 내린다.
 * 스토어 구독(app_store·play) 기록이 있는 사람만: 운영자가 DB에서 준 Premium(구독 기록 없음)이나 RevenueCat 운영자 권한(promotional)은 건드리지 않는다
 */
async function dropMovedSubscription(userId: string, reason: string): Promise<boolean> {
  const sub = must(await db.from('subscriptions').select('store,status').eq('user_id', userId).maybeSingle(), 'subscriptions') as { store: string; status: string } | null;
  if (!sub || (sub.store !== 'app_store' && sub.store !== 'play') || sub.status === 'canceled') return false;
  must(await db.rpc('set_plan', { p_user: userId, p_plan: 'free', p_until: null, p_reason: reason, p_only_if: 'plus' }), 'set_plan free');
  must(await db.from('subscriptions').update({ status: 'canceled', cancel_at_period_end: false }).eq('user_id', userId), 'subscriptions moved');
  console.log(`[billing] Premium 권한이 없어져 Free로 내림(${reason})`);
  return true;
}

// ---- 무료 체험(첫 구독만 7일, 앱 안 동의 팝업) ----

/** 이 회원이 전에 Premium을 구독한 적이 있는지(체험 중·해지 포함). 있으면 다시 구독할 때 체험 없이 바로 결제한다 */
export async function hadSubscription(userId: string): Promise<boolean> {
  const [sub, paid] = await Promise.all([
    db.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('purchases').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'subscription'),
  ]);
  return (sub.count ?? 0) > 0 || (paid.count ?? 0) > 0;
}

/** 지금 구독 상태(화면 표시용). 구독한 적이 없으면 null. store는 웹에서 스토어의 구독 관리 주소를 고르는 데 쓴다 */
export async function subscriptionView(
  userId: string,
): Promise<{ status: 'trial' | 'active' | 'past_due' | 'canceled'; periodEnd: string; cancelAtPeriodEnd: boolean; store: BillingStore | 'portone' } | null> {
  const row = must(await db.from('subscriptions').select('status,current_period_end,cancel_at_period_end,store').eq('user_id', userId).maybeSingle(), 'subscriptions') as
    | { status: 'trial' | 'active' | 'past_due' | 'canceled'; current_period_end: string; cancel_at_period_end: boolean; store: BillingStore | 'portone' }
    | null;
  return row ? { status: row.status, periodEnd: row.current_period_end, cancelAtPeriodEnd: row.cancel_at_period_end, store: row.store } : null;
}
