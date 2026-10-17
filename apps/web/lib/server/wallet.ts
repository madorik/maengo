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

/** 추가 구매한 맹고를 지갑에 넣는다. 같은 거래 ID는 한 번만 들어간다(true = 이번에 넣음) */
export async function creditMaengo(userId: string, n: number, transactionId: string): Promise<boolean> {
  await syncWallet(userId);
  return must(await db.rpc('wallet_credit', { p_user: userId, p_n: n, p_reason: 'purchase', p_ref: transactionId }), 'wallet_credit') as boolean;
}
