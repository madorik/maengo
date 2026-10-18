import 'server-only';
import { SIGNUP_BONUS } from '@maengo/core/plans';
import { db, must } from './db';

// 맹고 지갑(supabase/migrations/20261013100000_maengo_wallet.sql). 사라지지 않는 맹고(가입 선물·추가 구매한 맹고)만 둔다.
// 맹고 = 하루에 받는 소식. 하루 맹고(plans 표)보다 더 받을 때 여기서 1맹고씩 쓴다(feed.ts receiveMore, 그날 더 받은 수는 feed_days.extra).

/** 지갑 잔액(처음이면 만들고 가입 선물 맹고를 한 번 준다) */
export async function syncWallet(userId: string): Promise<number> {
  return must(await db.rpc('wallet_sync', { p_user: userId, p_signup: SIGNUP_BONUS }), 'wallet_sync') as number;
}

/** 가입 선물을 알려 줄 기간(받은 날부터) */
const GIFT_NOTICE_DAYS = 7;

/**
 * 최근에 가입해서 받은 가입 선물(금액은 실제로 들어간 값). 오늘 화면의 가입 이벤트 팝업용.
 * 가입일도 본다: 지갑이 생긴 날(2026-10-14) 기존 회원에게도 가입 선물이 들어갔는데, 그들에게 '가입 이벤트'를 띄우면 안 된다
 */
export async function recentSignupGift(userId: string, signedUpAt: number): Promise<{ amount: number; at: string } | null> {
  if (Date.now() - signedUpAt > GIFT_NOTICE_DAYS * 86_400_000) return null;
  const { data } = await db.from('wallet_ledger').select('delta,at').eq('user_id', userId).eq('reason', 'signup').maybeSingle();
  if (!data || data.delta <= 0 || Date.now() - Date.parse(data.at) > GIFT_NOTICE_DAYS * 86_400_000) return null;
  return { amount: data.delta, at: data.at };
}

/** n맹고를 쓴다. 모자라면 false. ref는 이 쓰임 하나에만 쓰는 값이어야 한다(되돌릴 때 같은 값) */
export async function spendMaengo(userId: string, n: number, ref: string): Promise<boolean> {
  await syncWallet(userId);
  const res = must(await db.rpc('wallet_spend', { p_user: userId, p_n: n, p_ref: ref }), 'wallet_spend') as { ok: boolean };
  return res.ok;
}

/** spendMaengo로 쓴 것을 그대로 돌려준다(한 번만) */
export async function refundMaengo(userId: string, ref: string): Promise<void> {
  must(await db.rpc('wallet_refund', { p_user: userId, p_ref: ref }), 'wallet_refund');
}

/**
 * 추가 구매한 맹고를 지갑에 넣는다(true = 이번에 넣음). 같은 거래는 누구에게든 한 번만 들어가고(ref = RevenueCat 거래, storeTx = 스토어 거래),
 * 환불로 회수한 거래는 다시 넣지 않는다(20261018191100_wallet_chargeback.sql)
 */
export async function creditMaengo(userId: string, n: number, ref: string, storeTx: string): Promise<boolean> {
  await syncWallet(userId);
  return must(await db.rpc('wallet_credit', { p_user: userId, p_n: n, p_reason: 'purchase', p_ref: ref, p_store_tx: storeTx }), 'wallet_credit') as boolean;
}

/**
 * 환불된 맹고 묶음: 그 거래로 넣은 맹고를 받은 회원의 지갑에서 한 번 뺀다(잔액까지만, 0 밑으로는 안 내린다).
 * 아직 넣지 않았으면 userId에게 0맹고 기록만 남겨 뒤늦게 넣지 않게 한다. 뺀 맹고 수, 이미 회수했으면 null
 */
export async function chargebackMaengo(userId: string, storeTx: string, ref: string | null): Promise<number | null> {
  return must(await db.rpc('wallet_chargeback', { p_user: userId, p_store_tx: storeTx, p_ref: ref }), 'wallet_chargeback') as number | null;
}

export type WalletReason = 'signup' | 'purchase' | 'more' | 'refund' | 'admin' | 'chargeback';

/** 지갑 내역(설정 > 플랜 > 지갑 내역): 최근 것부터 limit개. 0맹고 기록(넣기 전에 환불된 거래 표시)은 뺀다 */
export async function walletHistory(userId: string, limit = 50): Promise<{ at: string; reason: WalletReason; delta: number }[]> {
  const rows = must(
    await db.from('wallet_ledger').select('at,reason,delta').eq('user_id', userId).neq('delta', 0).order('at', { ascending: false }).order('id', { ascending: false }).limit(limit),
    'wallet_ledger',
  ) as { at: string; reason: WalletReason; delta: number }[];
  return rows;
}
