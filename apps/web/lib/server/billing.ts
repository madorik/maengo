import 'server-only';
import { readSubscriber, type RcSubscriber } from '../billing/revenuecat';
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

export async function syncBilling(userId: string): Promise<BillingSyncResult> {
  const exists = must(await db.from('profiles').select('id').eq('id', userId).maybeSingle(), 'profiles') as { id: string } | null;
  if (!exists) return { plan: 'unchanged', credited: 0 };
  const state = readSubscriber(await fetchSubscriber(userId), new Date());
  let plan: BillingSyncResult['plan'] = 'unchanged';

  if (state.premium) {
    const p = state.premium;
    if (p.active) {
      must(await db.from('profiles').update({ plan: 'plus', premium_until: p.until }).eq('id', userId), 'profiles plus');
      plan = 'plus';
    } else {
      must(await db.from('profiles').update({ plan: 'free', premium_until: null }).eq('id', userId).eq('plan', 'plus'), 'profiles free');
      plan = 'free';
    }
    must(
      await db.from('subscriptions').upsert(
        {
          user_id: userId,
          store: p.store,
          store_ref: p.ref,
          status: !p.active ? 'canceled' : p.billingIssue ? 'past_due' : 'active',
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
