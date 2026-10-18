import 'server-only';
import { paymentFromEvent, paymentsFromSubscriber, readSubscriber, type PaymentRow, type RcEvent, type RcSubscriber } from '../billing/revenuecat';
import { db, must } from './db';
import { creditMaengo } from './wallet';

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
  const pay = userId ? paymentFromEvent(e, userId) : null;
  if (pay) await recordPayments([pay]);
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
  for (const pack of state.packs) if (await creditMaengo(userId, pack.amount, pack.ref)) credited += pack.amount;
  return { plan, credited };
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

/** 지금 구독 상태(화면 표시용). 구독한 적이 없으면 null */
export async function subscriptionView(userId: string): Promise<{ status: 'trial' | 'active' | 'past_due' | 'canceled'; periodEnd: string; cancelAtPeriodEnd: boolean } | null> {
  const row = must(await db.from('subscriptions').select('status,current_period_end,cancel_at_period_end').eq('user_id', userId).maybeSingle(), 'subscriptions') as
    | { status: 'trial' | 'active' | 'past_due' | 'canceled'; current_period_end: string; cancel_at_period_end: boolean }
    | null;
  return row ? { status: row.status, periodEnd: row.current_period_end, cancelAtPeriodEnd: row.cancel_at_period_end } : null;
}
