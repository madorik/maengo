import { packAmount } from '@maengo/core/plans';
import type { PremiumUse, PurchaseFacts, RefundVerdict } from './refund-policy';

// 문의 챗봇·관리자 화면에 보이는 결제·판정 문구(서버·화면 공용).

const kstParts = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: String(d.getUTCHours()).padStart(2, '0'), mm: String(d.getUTCMinutes()).padStart(2, '0') };
};

/** '10월 24일' */
export const dayLabel = (iso: string) => {
  const p = kstParts(iso);
  return `${p.m}월 ${p.d}일`;
};

/** '10월 24일 15:02' */
export const timeLabel = (iso: string) => {
  const p = kstParts(iso);
  return `${p.m}월 ${p.d}일 ${p.hh}:${p.mm}`;
};

export const itemLabel = (p: Pick<PurchaseFacts, 'kind' | 'productId'>) => (p.kind === 'subscription' ? 'Premium 1개월' : `맹고 ${packAmount(p.productId) ?? '?'}개`);

/** 결제의 스토어(purchases.store: play_store)와 구독의 스토어(subscriptions.store: play)를 모두 받는다 */
export const storeLabel = (store: string) => ({ app_store: 'App Store', play_store: 'Google Play', play: 'Google Play', test_store: '시험 결제', promotional: '운영자 지급' })[store] ?? store;

export function moneyLabel(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null;
  if (!currency || currency === 'KRW') return `${Math.round(amount).toLocaleString('ko-KR')}원`;
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

export function useLabel(u: PremiumUse, free: { dailyItems: number; dailyListens: number }): string {
  if (u.kind === 'premium_read') return `하루 ${free.dailyItems + 1}번째부터의 소식 ${u.count}개 읽음(${dayLabel(u.at)}부터)`;
  if (u.kind === 'extra_listen') return `하루 ${free.dailyListens + 1}개째부터 음성 ${u.count}개 들음(${dayLabel(u.at)}부터)`;
  return `플레이리스트에 소식 ${u.count}개 담음(${dayLabel(u.at)}부터)`;
}

/** 판정 이유 한 문장(회원에게 그대로 보여도 되는 말) */
export function verdictLabel(p: PurchaseFacts, v: RefundVerdict, deadline: string, free: { dailyItems: number; dailyListens: number }): string {
  if (v.ok && v.scope === 'full') {
    return p.kind === 'subscription'
      ? `${dayLabel(deadline)}까지 환불할 수 있어요. 결제 뒤 Premium 기능을 쓰지 않았어요.`
      : `${dayLabel(deadline)}까지 환불할 수 있어요. 구매한 맹고를 쓰지 않았어요.`;
  }
  if (v.ok) return `구매한 ${v.total}개 중 ${v.total - v.units}개를 써서, 남은 ${v.units}개만큼(${moneyLabel(v.amount, p.currency) ?? '남은 비율만큼'}) ${dayLabel(deadline)}까지 환불할 수 있어요.`;
  switch (v.reason) {
    case 'refunded':
      return '이미 환불된 결제예요.';
    case 'trial':
      return '무료 체험 시작이라 결제된 금액이 없어요. 체험 중에 해지하면 결제되지 않아요.';
    case 'not_store':
      return '스토어 결제가 아니라 환불할 금액이 없어요.';
    case 'unknown_product':
      return '알 수 없는 상품이에요.';
    case 'expired':
      return `결제한 날부터 7일(${dayLabel(v.deadline)}까지)이 지나 환불할 수 없어요.`;
    case 'used':
      return `결제 뒤 Premium 기능을 써서 환불할 수 없어요: ${v.uses.map((u) => useLabel(u, free)).join(', ')}.`;
    case 'spent':
      return v.spent >= v.total ? `이 구매의 맹고 ${v.total}개를 모두 써서 환불할 수 없어요.` : '지갑에 남은 맹고가 없어 환불할 수 없어요.';
  }
}
