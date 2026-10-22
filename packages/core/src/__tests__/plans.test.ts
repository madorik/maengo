import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveLabel, daysBefore, discountPct, packAmount, planFromRow } from '../plans';

test('n일 전', () => {
  assert.equal(daysBefore('2026-10-03', 6), '2026-09-27');
  assert.equal(daysBefore('2026-03-01', 1), '2026-02-28');
});

test('맹고 묶음 상품 ID', () => {
  assert.equal(packAmount('maengo_pack_10'), 10);
  assert.equal(packAmount('maengo_pack_100:base'), 100);
  assert.equal(packAmount('maengo_pack_500'), null);
  assert.equal(packAmount('maengo_premium_monthly'), null);
});

test('plans 표 한 줄 → PlanLimits', () => {
  const l = planFromRow({ id: 'free', name: 'Free', price_krw: 0, list_price_krw: null, daily_items: 3, audio: false, topic_limit: 5, custom_limit: 0, link_limit: 0, can_buy_maengo: false, archive_days: 7 });
  assert.deepEqual(l, { id: 'free', name: 'Free', priceKrw: 0, listPriceKrw: null, dailyItems: 3, audio: false, topicLimit: 5, customLimit: 0, linkLimit: 0, canBuyMaengo: false, archiveDays: 7 });
});

test('할인율은 내림', () => {
  assert.equal(discountPct({ priceKrw: 3800, listPriceKrw: 5900 }), 35);
  assert.equal(discountPct({ priceKrw: 4100, listPriceKrw: 5900 }), 30);
  assert.equal(discountPct({ priceKrw: 5900, listPriceKrw: null }), 0);
  assert.equal(discountPct({ priceKrw: 5900, listPriceKrw: 5900 }), 0);
});

test('보관 기간 표기: 없으면 무제한, 30일 단위는 개월', () => {
  assert.equal(archiveLabel(null), '무제한');
  assert.equal(archiveLabel(90), '3개월');
  assert.equal(archiveLabel(45), '45일');
});
