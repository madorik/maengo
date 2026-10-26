import 'server-only';
import { addDays, kstDate } from '@maengo/core/kst';
import { dayLabel, itemLabel, moneyLabel, storeLabel, timeLabel, verdictLabel } from '../support/labels';
import { billingConfigured, subscriptionView, syncBilling } from './billing';
import { db, must } from './db';
import { getPlans } from './plans';
import { refundCases, type RefundCase } from './refund-cases';
import { syncWallet } from './wallet';

// 문의 답장 초안 전에 회원 기록을 확인한다(2026-10-26 사용자: 문의 내용을 DB 내역·결제 내역으로 확인하고 정책대로 답하게).
// 결제 문의면 먼저 RevenueCat에서 결제를 다시 읽어 빠진 Premium·맹고를 넣는다(앱이 결제 뒤 부르는 것과 같은 일, 몇 번 해도 결과가 같다).
// 그다음 플랜·구독·지갑·결제별 환불 판정(lib/support/refund-policy.ts)·알림 상태를 사람이 읽는 줄로 만든다.
// text는 Gemini와 관리자에게, extra(주문 번호 등)는 관리자에게만 보인다. 맹고-문서/문의하기.md

export interface FactLine {
  text: string;
  /** 관리자에게만(주문 번호처럼 Gemini에 보낼 필요 없는 값) */
  extra?: string;
}

/** 결제를 다시 읽어 볼 문의: 결제·환불 종류이거나 내용에 결제 낱말이 있으면 */
export const mentionsBilling = (category: string, body: string) =>
  category === 'billing' || /결제|구매|환불|구독|해지|복원|맹고|지갑|프리미엄|premium|영수증|청구/i.test(body);

const WALLET: Record<string, string> = { signup: '가입 선물', purchase: '구매', more: '하나 더 받기', refund: '되돌림', admin: '운영자 지급', chargeback: '환불 회수' };
const DELIVERY: Record<string, string> = {
  pending: '대기',
  building: '만드는 중',
  ready: '보낼 차례',
  sending: '보내는 중',
  sent: '알림 보냄',
  empty: '줄 소식이 없음',
  no_device: '알림 받을 기기가 없어 못 보냄',
  failed: '보내기 실패',
};
const SUB: Record<string, string> = { trial: '무료 체험 중', active: '구독 중', past_due: '갱신 결제 실패(스토어가 다시 시도 중)', canceled: '끝남' };

/** 환불을 누가 어떻게 하는지(정책: Google Play는 운영자, App Store는 회원이 애플에 요청) */
function howToRefund(c: RefundCase): string {
  switch (c.route) {
    case 'play':
      return '환불 방법: Google Play 결제라 운영자가 전액 환불한다';
    case 'operator':
      return '환불 방법: Google Play 일부 환불이라 운영자가 남은 맹고 금액만 부분 환불하고 지갑에서 남은 맹고를 뺀다';
    case 'apple':
      return '환불 방법: App Store 결제라 회원이 Apple(reportaproblem.apple.com)에 직접 요청하고 Apple이 정한다';
    case 'test':
      return '시험 결제라 실제 환불 없음';
    default:
      return '';
  }
}

/** 회원 기록을 확인해 줄로 만든다. resync면 결제를 먼저 다시 읽는다 */
export async function inquiryFacts(userId: string, opts: { resync: boolean }): Promise<FactLine[]> {
  const out: FactLine[] = [];
  const before = must(await db.from('profiles').select('plan').eq('id', userId).maybeSingle(), 'profiles') as { plan: string } | null;
  if (!before) return [{ text: '회원 기록이 없음(탈퇴했을 수 있음)' }];

  if (opts.resync && billingConfigured()) {
    try {
      const r = await syncBilling(userId, 'inquiry');
      const fixed = [before.plan === 'free' && r.plan === 'plus' && 'Premium이 빠져 있어 방금 반영함', r.credited > 0 && `구매한 맹고 ${r.credited}개가 지갑에 빠져 있어 방금 넣음`].filter(Boolean);
      out.push({ text: `결제 다시 확인(스토어 기록): ${fixed.length ? fixed.join(', ') : '빠진 결제 없음'}` });
    } catch (e) {
      out.push({ text: '결제 다시 확인: 스토어 기록을 읽지 못함(운영자가 직접 확인)', extra: String((e as Error).message ?? e).slice(0, 120) });
    }
  }

  const today = kstDate();
  const [plans, profile, sub, wallet, ledger, cases, devices, jobs, events] = await Promise.all([
    getPlans(),
    db.from('profiles').select('plan,premium_until,notify_at,push_enabled,created_at').eq('id', userId).single(),
    subscriptionView(userId),
    syncWallet(userId),
    db.from('wallet_ledger').select('at,reason,delta').eq('user_id', userId).neq('delta', 0).order('at', { ascending: false }).limit(6),
    refundCases(userId),
    db.from('device_tokens').select('platform').eq('user_id', userId),
    db.from('delivery_jobs').select('date,status').eq('user_id', userId).gte('date', addDays(today, -3)).order('date', { ascending: false }),
    db.from('billing_events').select('type,event_at').eq('user_id', userId).order('event_at', { ascending: false }).limit(4),
  ]);
  const p = must(profile, 'profiles') as { plan: 'free' | 'plus'; premium_until: string | null; notify_at: string; push_enabled: boolean; created_at: string };
  const free = plans.get('free')!;

  out.push({ text: `가입: ${dayLabel(p.created_at)}` });
  out.push({ text: `플랜: ${plans.get(p.plan)!.name}${p.plan !== 'free' && p.premium_until ? `(${timeLabel(p.premium_until)}까지)` : ''}` });
  if (sub) out.push({ text: `구독: ${storeLabel(sub.store)} · ${SUB[sub.status]}${sub.cancelAtPeriodEnd && sub.status !== 'canceled' ? ' · 해지함(기간이 끝나면 Free, 다음 결제 없음)' : ''}` });

  if (cases.length) {
    out.push({ text: '최근 90일 결제와 환불 판정(이용약관 제6조):' });
    for (const c of cases) {
      const how = c.verdict.ok ? howToRefund(c) : '';
      out.push({
        text: `- ${timeLabel(c.purchase.purchasedAt)} ${itemLabel(c.purchase)} · ${storeLabel(c.purchase.store)} · ${moneyLabel(c.purchase.price, c.purchase.currency) ?? '금액 모름'} → ${c.verdict.ok ? '환불 가능' : '환불 불가'}: ${verdictLabel(c.purchase, c.verdict, c.deadline, free)}${how ? ` ${how}.` : ''}`,
      });
    }
  } else {
    out.push({ text: '최근 90일 결제: 없음(맹고 계정에 연결된 스토어 결제가 없음)' });
  }
  const txs = must(await db.from('purchases').select('purchased_at,store,transaction_id').eq('user_id', userId).order('purchased_at', { ascending: false }).limit(5), 'purchases tx') as {
    purchased_at: string | null;
    store: string;
    transaction_id: string;
  }[];
  if (txs.length) out.push({ text: '주문 번호는 관리자 화면에만 있음', extra: txs.map((t) => `${t.purchased_at ? dayLabel(t.purchased_at) : '?'} ${storeLabel(t.store)} ${t.transaction_id}`).join(' / ') });

  const led = must(ledger, 'wallet_ledger') as { at: string; reason: string; delta: number }[];
  out.push({ text: `지갑 맹고: ${wallet}개${led.length ? ` (최근: ${led.map((l) => `${dayLabel(l.at)} ${WALLET[l.reason] ?? l.reason} ${l.delta > 0 ? '+' : ''}${l.delta}`).join(', ')})` : ''}` });

  const dev = must(devices, 'device_tokens') as { platform: string }[];
  const count = (pf: string) => dev.filter((d) => d.platform === pf).length;
  out.push({ text: `알림: ${p.push_enabled ? '켜짐' : '꺼짐(설정 > 알림에서 켜야 받음)'}, 받을 시각 ${p.notify_at.slice(0, 5)}, 알림 받을 기기 iOS ${count('ios')}·Android ${count('android')}·웹 ${count('web')}` });
  const j = must(jobs, 'delivery_jobs') as { date: string; status: string }[];
  if (j.length) out.push({ text: `최근 하루 소식 알림: ${j.map((x) => `${dayLabel(`${x.date}T12:00:00+09:00`)} ${DELIVERY[x.status] ?? x.status}`).join(', ')}` });

  const ev = must(events, 'billing_events') as { type: string; event_at: string | null }[];
  if (ev.length) out.push({ text: `최근 결제 알림(RevenueCat): ${ev.map((e) => `${e.event_at ? dayLabel(e.event_at) : '?'} ${e.type}`).join(', ')}` });
  return out;
}
