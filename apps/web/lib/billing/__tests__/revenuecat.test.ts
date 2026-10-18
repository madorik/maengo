import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentFromEvent, paymentsFromSubscriber, readSubscriber, type RcSubscriber } from '../revenuecat';

const now = new Date('2026-10-13T00:00:00Z');

test('구독 중: 기한·스토어·원거래 ID', () => {
  const sub: RcSubscriber = {
    entitlements: { premium: { expires_date: '2026-11-13T00:00:00Z', product_identifier: 'maengo_premium_monthly' } },
    subscriptions: { maengo_premium_monthly: { expires_date: '2026-11-13T00:00:00Z', store: 'app_store', store_transaction_id: 't1' } },
  };
  const s = readSubscriber(sub, now);
  assert.deepEqual(s.premium, {
    active: true,
    until: '2026-11-13T00:00:00Z',
    productId: 'maengo_premium_monthly',
    store: 'app_store',
    cancelAtPeriodEnd: false,
    billingIssue: false,
    trial: false,
    ref: 't1',
  });
});

test('무료 체험 중이면 trial', () => {
  const s = readSubscriber(
    {
      entitlements: { premium: { expires_date: '2026-10-20T00:00:00Z', product_identifier: 'maengo_premium_monthly' } },
      subscriptions: { maengo_premium_monthly: { expires_date: '2026-10-20T00:00:00Z', store: 'app_store', period_type: 'trial' } },
    },
    now,
  );
  assert.equal(s.premium?.active, true);
  assert.equal(s.premium?.trial, true);
  assert.equal(paymentsFromSubscriber({ subscriptions: { maengo_premium_monthly: { expires_date: null, store: 'app_store', store_transaction_id: 'x', period_type: 'trial' } } }, 'u1')[0]?.period_type, 'trial');
});

test('기간이 지났으면 끝, 유예 기간이면 아직', () => {
  const ended = readSubscriber({ entitlements: { premium: { expires_date: '2026-10-12T00:00:00Z', product_identifier: 'p' } } }, now);
  assert.equal(ended.premium?.active, false);
  const grace = readSubscriber(
    { entitlements: { premium: { expires_date: '2026-10-12T00:00:00Z', grace_period_expires_date: '2026-10-20T00:00:00Z', product_identifier: 'p' } } },
    now,
  );
  assert.equal(grace.premium?.active, true);
  assert.equal(grace.premium?.until, '2026-10-20T00:00:00Z');
});

test('플레이 구독 ID(기본요금제 붙음)와 해지 예약', () => {
  const s = readSubscriber(
    {
      entitlements: { premium: { expires_date: '2026-11-01T00:00:00Z', product_identifier: 'maengo_premium_monthly:monthly' } },
      subscriptions: { 'maengo_premium_monthly:monthly': { expires_date: '2026-11-01T00:00:00Z', store: 'play_store', unsubscribe_detected_at: '2026-10-10T00:00:00Z' } },
    },
    now,
  );
  assert.equal(s.premium?.store, 'play');
  assert.equal(s.premium?.cancelAtPeriodEnd, true);
});

test('운영자가 준 평생 권한은 기한 없음', () => {
  const s = readSubscriber({ entitlements: { premium: { expires_date: null, product_identifier: 'rc_promo_premium_lifetime' } } }, now);
  assert.equal(s.premium?.active, true);
  assert.equal(s.premium?.until, null);
  assert.equal(s.premium?.store, 'promotional');
});

test('맹고 묶음은 거래마다 하나, 모르는 상품은 뺀다', () => {
  const s = readSubscriber(
    { non_subscriptions: { maengo_pack_100: [{ id: 'a' }, { id: 'b' }], maengo_pack_30: [{ id: 'c' }], something_else: [{ id: 'd' }] } },
    now,
  );
  assert.equal(s.premium, null);
  assert.deepEqual(s.packs, [
    { ref: 'rc:a', productId: 'maengo_pack_100', amount: 100 },
    { ref: 'rc:b', productId: 'maengo_pack_100', amount: 100 },
    { ref: 'rc:c', productId: 'maengo_pack_30', amount: 30 },
  ]);
});

test('결제 기록: 구독자 응답의 구독(지금 기간)과 맹고 묶음 전부', () => {
  const rows = paymentsFromSubscriber(
    {
      subscriptions: {
        'maengo_premium_monthly:monthly': { expires_date: '2026-11-18T00:00:00Z', purchase_date: '2026-10-18T00:00:00Z', store: 'play_store', store_transaction_id: 'GPA.1', is_sandbox: true, price: { amount: 3800, currency: 'KRW' } },
      },
      non_subscriptions: { maengo_pack_10: [{ id: 'rc1', store: 'app_store', store_transaction_id: '2000001', purchase_date: '2026-10-18T01:00:00Z' }] },
    },
    'u1',
  );
  assert.deepEqual(
    rows.map((r) => [r.kind, r.store, r.transaction_id, r.rc_id, r.price, r.sandbox, r.source]),
    [
      ['subscription', 'play_store', 'GPA.1', null, 3800, true, 'sync'],
      ['pack', 'app_store', '2000001', 'rc1', null, false, 'sync'],
    ],
  );
});

test('결제 기록: 웹훅은 돈이 오간 이벤트만, 스토어 이름은 소문자로', () => {
  const renewal = paymentFromEvent(
    { type: 'RENEWAL', store: 'APP_STORE', environment: 'PRODUCTION', transaction_id: 't2', original_transaction_id: 't1', product_id: 'maengo_premium_monthly', purchased_at_ms: Date.parse('2026-11-18T00:00:00Z'), expiration_at_ms: Date.parse('2026-12-18T00:00:00Z'), price: 2.6, price_in_purchased_currency: 3800, currency: 'KRW' },
    'u1',
  );
  assert.equal(renewal?.store, 'app_store');
  assert.equal(renewal?.price, 3800);
  assert.equal(renewal?.price_usd, 2.6);
  assert.equal(renewal?.expires_at, '2026-12-18T00:00:00.000Z');
  assert.equal(renewal?.source, 'webhook:RENEWAL');
  assert.equal(paymentFromEvent({ type: 'CANCELLATION', transaction_id: 't2', product_id: 'maengo_premium_monthly' }, 'u1'), null);
});
