import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgePack, judgeSubscription, packLots, refundDeadline, refundPreference, refundRoute, type PurchaseFacts } from '../refund-policy';

const sub = (o: Partial<PurchaseFacts> = {}): PurchaseFacts => ({
  id: 1,
  store: 'play_store',
  productId: 'maengo_premium_monthly:monthly',
  kind: 'subscription',
  periodType: 'normal',
  purchasedAt: '2026-10-20T06:00:00Z', // 10-20 15:00 KST
  price: 3800,
  currency: 'KRW',
  refundedAt: null,
  sandbox: false,
  ...o,
});
const pack = (o: Partial<PurchaseFacts> = {}): PurchaseFacts => sub({ id: 2, productId: 'maengo_pack_30', kind: 'pack', periodType: null, price: 2900, ...o });

test('7일: 결제한 날 다음 날부터 7일째 끝(한국 시간)', () => {
  assert.equal(refundDeadline('2026-10-20T06:00:00Z'), '2026-10-27T14:59:59.999Z');
  // 한국 자정 직후 결제는 그날이 결제일
  assert.equal(refundDeadline('2026-10-19T15:30:00Z'), '2026-10-27T14:59:59.999Z');
});

test('구독: 7일 안·Premium 기능 안 씀 → 전액', () => {
  assert.deepEqual(judgeSubscription(sub(), [], new Date('2026-10-27T14:00:00Z')), { ok: true, scope: 'full', amount: 3800 });
});

test('구독: 결제 뒤 Premium 기능을 썼으면 불가, 쓴 기록을 돌려준다', () => {
  const uses = [{ kind: 'extra_listen' as const, at: '2026-10-21T00:00:00Z', count: 2 }];
  assert.deepEqual(judgeSubscription(sub(), uses, new Date('2026-10-22T00:00:00Z')), { ok: false, reason: 'used', uses });
});

test('구독: 7일 지나면 불가(안 썼어도)', () => {
  const v = judgeSubscription(sub(), [], new Date('2026-10-27T15:00:00Z'));
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.reason, 'expired');
});

test('구독: 체험 시작은 결제가 아니다, 이미 환불·운영자 권한은 대상 아님', () => {
  assert.deepEqual(judgeSubscription(sub({ periodType: 'trial', price: 0 }), [], new Date('2026-10-21T00:00:00Z')), { ok: false, reason: 'trial' });
  assert.deepEqual(judgeSubscription(sub({ refundedAt: '2026-10-21T00:00:00Z' }), [], new Date('2026-10-21T00:00:00Z')), { ok: false, reason: 'refunded' });
  assert.deepEqual(judgeSubscription(sub({ store: 'promotional' }), [], new Date('2026-10-21T00:00:00Z')), { ok: false, reason: 'not_store' });
});

test('묶음: 하나도 안 썼으면 전액', () => {
  assert.deepEqual(judgePack(pack(), 30, 40, new Date('2026-10-21T00:00:00Z')), { ok: true, scope: 'full', amount: 2900 });
});

test('묶음: 쓴 만큼 빼고 남은 맹고만', () => {
  // 30개 사서 12개 씀(남은 18개) → 2900*18/30 = 1740원
  assert.deepEqual(judgePack(pack(), 18, 28, new Date('2026-10-21T00:00:00Z')), { ok: true, scope: 'partial', units: 18, total: 30, amount: 1740 });
  // 지갑에 남은 것보다 많이 돌려주지 않는다
  assert.deepEqual(judgePack(pack(), 30, 5, new Date('2026-10-21T00:00:00Z')), { ok: true, scope: 'partial', units: 5, total: 30, amount: 483 });
});

test('묶음: 다 썼으면 불가, 7일 지나면 불가', () => {
  assert.deepEqual(judgePack(pack(), 0, 10, new Date('2026-10-21T00:00:00Z')), { ok: false, reason: 'spent', spent: 30, total: 30 });
  const v = judgePack(pack(), 30, 30, new Date('2026-10-28T00:00:00Z'));
  assert.equal(!v.ok && v.reason, 'expired');
});

test('누가 환불하나: 구글 전액은 맹고가 바로, 구글 일부는 운영자, 애플은 애플, 시험 결제는 판정만', () => {
  const full = { ok: true, scope: 'full', amount: 2900 } as const;
  const part = { ok: true, scope: 'partial', units: 5, total: 30, amount: 483 } as const;
  assert.equal(refundRoute(pack(), full), 'play');
  assert.equal(refundRoute(pack(), part), 'operator');
  assert.equal(refundRoute(pack({ store: 'app_store' }), part), 'apple');
  assert.equal(refundRoute(pack({ store: 'test_store' }), full), 'test');
  assert.equal(refundRoute(pack({ sandbox: true }), full), 'test');
  assert.equal(refundRoute(pack(), { ok: false, reason: 'refunded' }), 'none');
});

test('스토어 환불 의견: 모두 대상이면 찬성, 하나도 아니면 반대, 섞이면 스토어가 정함', () => {
  const now = new Date('2026-10-21T00:00:00Z');
  const ok = { ok: true, scope: 'full', amount: 3800 } as const;
  const no = { ok: false, reason: 'expired', deadline: '' } as const;
  assert.equal(refundPreference([{ purchase: sub(), verdict: ok }], now), 'grant');
  assert.equal(refundPreference([{ purchase: sub(), verdict: no }], now), 'decline');
  assert.equal(refundPreference([{ purchase: sub(), verdict: ok }, { purchase: pack(), verdict: no }], now), 'neutral');
  // 체험 시작·시험 결제·90일 넘은 결제는 보지 않는다
  assert.equal(refundPreference([{ purchase: sub({ periodType: 'trial' }), verdict: { ok: false, reason: 'trial' } }], now), null);
  assert.equal(refundPreference([{ purchase: sub({ store: 'test_store' }), verdict: ok }], now), null);
  assert.equal(refundPreference([{ purchase: sub({ purchasedAt: '2026-07-01T00:00:00Z' }), verdict: no }], now), null);
});

test('남은 맹고: 가입 선물 → 구매한 맹고 먼저(먼저 산 것부터) → 되돌림은 뺐던 묶음에, 회수된 묶음은 0', () => {
  const lots = packLots([
    { reason: 'signup', delta: 10, ref: 'signup' },
    { reason: 'more', delta: -2, ref: 'm1' }, // 산 맹고가 없을 때: 가입 선물에서
    { reason: 'purchase', delta: 30, ref: 'rc:a' },
    { reason: 'purchase', delta: 10, ref: 'rc:b' },
    { reason: 'more', delta: -12, ref: 'm2' }, // a에서 12
    { reason: 'more', delta: -20, ref: 'm3' }, // a에서 18, b에서 2
    { reason: 'refund', delta: 20, ref: 'm3' }, // m3을 받지 못해 되돌림 → a 18, b 2 복구
    { reason: 'more', delta: -1, ref: 'm4' },
  ]);
  assert.equal(lots.get('rc:a'), 17);
  assert.equal(lots.get('rc:b'), 10);
  const charged = packLots([
    { reason: 'purchase', delta: 10, ref: 'rc:a' },
    { reason: 'purchase', delta: 10, ref: 'rc:b' },
    { reason: 'chargeback', delta: -10, ref: 'rc:a' },
    { reason: 'more', delta: -3, ref: 'm1' },
  ]);
  assert.equal(charged.get('rc:a'), 0);
  assert.equal(charged.get('rc:b'), 7);
});
