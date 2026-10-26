import 'server-only';
import { kstDate } from '@maengo/core/kst';
import {
  judgePack, judgeSubscription, packLots, refundDeadline, refundRoute, STORE_REFUND_LOOKBACK_DAYS,
  type LedgerRow, type PremiumUse, type PurchaseFacts, type RefundRoute, type RefundVerdict,
} from '../support/refund-policy';
import { db, must } from './db';
import { getPlans } from './plans';
import { syncWallet } from './wallet';

// 환불 판정에 쓰는 이용 기록을 DB에서 모은다(판정 자체는 lib/support/refund-policy.ts). 읽기만 한다.
// 문의 답장 초안(lib/server/inquiry-facts.ts)이 쓴다. 환불을 실제로 하는 쪽(RevenueCat)은 feature/support-chatbot 브랜치에 있다.
// 맹고-문서/환불과-구매-복원.md

export interface RefundCase {
  purchase: PurchaseFacts;
  verdict: RefundVerdict;
  route: RefundRoute;
  /** 환불할 수 있는 마지막 순간 */
  deadline: string;
}

type PurchaseRow = {
  id: number;
  store: string;
  product_id: string;
  kind: 'subscription' | 'pack' | 'other';
  period_type: string | null;
  purchased_at: string;
  price: number | string | null;
  currency: string | null;
  refunded_at: string | null;
  sandbox: boolean;
  transaction_id: string;
  rc_id: string | null;
};

const PURCHASE_COLS = 'id,store,product_id,kind,period_type,purchased_at,price,currency,refunded_at,sandbox,transaction_id,rc_id';

const factsOf = (r: PurchaseRow): PurchaseFacts => ({
  id: r.id,
  store: r.store,
  productId: r.product_id,
  kind: r.kind,
  periodType: r.period_type,
  purchasedAt: r.purchased_at,
  price: r.price === null ? null : Number(r.price),
  currency: r.currency,
  refundedAt: r.refunded_at,
  sandbox: r.sandbox,
});

/**
 * since 뒤에 Premium에서만 되는 것을 쓴 기록:
 * - 하루 소식 중 Free 몫(plans free.daily_items)보다 뒤 순위인 소식을 읽음. 그날 맹고로 더 받은 소식(feed_days.extra)은 빼고 본다
 * - 하루(한국 시간)에 Free 몫(plans free.daily_listens)보다 많이 들음(전체 듣기·플레이리스트로 들은 것 포함)
 * - 플레이리스트에 담음
 */
export async function premiumUsesSince(userId: string, since: string): Promise<PremiumUse[]> {
  const free = (await getPlans()).get('free')!;
  const [readRes, listenRes, playlistRes] = await Promise.all([
    db.from('reads').select('cluster_id,read_at').eq('user_id', userId).gte('read_at', since).order('read_at'),
    db.from('reads').select('listened_at').eq('user_id', userId).gte('listened_at', since).order('listened_at'),
    db.from('playlist_items').select('added_at').eq('user_id', userId).gte('added_at', since).order('added_at'),
  ]);
  const reads = must(readRes, 'reads since') as { cluster_id: number; read_at: string }[];
  const listens = must(listenRes, 'listens since') as { listened_at: string }[];
  const playlist = must(playlistRes, 'playlist since') as { added_at: string }[];
  const uses: PremiumUse[] = [];

  if (reads.length) {
    const feeds = must(
      await db.from('feeds').select('cluster_id,date,rank').eq('user_id', userId).in('cluster_id', reads.map((r) => r.cluster_id)).gt('rank', free.dailyItems),
      'feeds premium part',
    ) as { cluster_id: number; date: string; rank: number }[];
    const dates = [...new Set(feeds.map((f) => f.date))];
    const days = dates.length
      ? (must(await db.from('feed_days').select('date,visible,extra').eq('user_id', userId).in('date', dates), 'feed_days premium part') as { date: string; visible: number; extra: number }[])
      : [];
    // 그날 플랜이 준 몫(맹고로 더 받은 것 빼고)의 끝 순위
    const planEnd = new Map(days.map((d) => [d.date, d.visible - d.extra]));
    const premium = new Set(feeds.filter((f) => f.rank <= (planEnd.get(f.date) ?? 0)).map((f) => f.cluster_id));
    const hits = reads.filter((r) => premium.has(r.cluster_id));
    if (hits.length) uses.push({ kind: 'premium_read', at: hits[0]!.read_at, count: hits.length });
  }

  if (listens.length) {
    const byDay = new Map<string, string[]>();
    for (const l of listens) {
      const day = kstDate(new Date(l.listened_at));
      byDay.set(day, [...(byDay.get(day) ?? []), l.listened_at]);
    }
    const over = [...byDay.values()].filter((list) => list.length > free.dailyListens);
    if (over.length) uses.push({ kind: 'extra_listen', at: over[0]![free.dailyListens]!, count: over.reduce((n, list) => n + list.length - free.dailyListens, 0) });
  }

  if (playlist.length) uses.push({ kind: 'playlist', at: playlist[0]!.added_at, count: playlist.length });
  return uses.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** 구매 묶음마다 아직 안 쓴 맹고(ref 'rc:거래' → 수). 지갑 기록 전부를 시각 순서로 따라간다(packLots) */
export async function packLotsOf(userId: string): Promise<Map<string, number>> {
  const rows = must(await db.from('wallet_ledger').select('reason,delta,ref').eq('user_id', userId).order('at').order('id'), 'wallet_ledger') as LedgerRow[];
  return packLots(rows);
}

async function recentPurchases(userId: string, now: Date): Promise<PurchaseRow[]> {
  const since = new Date(now.getTime() - STORE_REFUND_LOOKBACK_DAYS * 86_400_000).toISOString();
  return must(
    await db.from('purchases').select(PURCHASE_COLS).eq('user_id', userId).in('kind', ['subscription', 'pack']).not('purchased_at', 'is', null).gte('purchased_at', since).order('purchased_at', { ascending: false }).limit(30),
    'purchases recent',
  ) as PurchaseRow[];
}

/** 최근 90일 결제마다 환불 판정(최근 것부터) */
export async function refundCases(userId: string, now = new Date()): Promise<RefundCase[]> {
  const rows = await recentPurchases(userId, now);
  if (!rows.length) return [];
  const hasPack = rows.some((r) => r.kind === 'pack');
  const [balance, lots] = hasPack ? await Promise.all([syncWallet(userId), packLotsOf(userId)]) : [0, new Map<string, number>()];
  const out: RefundCase[] = [];
  for (const r of rows) {
    const p = factsOf(r);
    // 7일이 지났으면 이용 기록을 읽지 않아도 판정이 같다
    const open = now.getTime() <= Date.parse(refundDeadline(p.purchasedAt));
    const verdict =
      p.kind === 'subscription'
        ? judgeSubscription(p, open ? await premiumUsesSince(userId, p.purchasedAt) : [], now)
        : judgePack(p, r.rc_id ? (lots.get(`rc:${r.rc_id}`) ?? 0) : 0, balance, now);
    out.push({ purchase: p, verdict, route: refundRoute(p, verdict), deadline: refundDeadline(p.purchasedAt) });
  }
  return out;
}

