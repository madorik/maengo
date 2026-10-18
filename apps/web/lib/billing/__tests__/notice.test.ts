import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billingNoticeOf } from '../notice';

const now = new Date('2026-10-18T03:00:00Z');
const trial = (periodEnd: string, cancelAtPeriodEnd = false) => ({ status: 'trial' as const, periodEnd, cancelAtPeriodEnd, store: 'app_store' });

test('무료 체험은 끝나기 이틀 안에만 알린다(해지 예약했으면 안 알린다)', () => {
  assert.deepEqual(billingNoticeOf(trial('2026-10-19T03:00:00Z'), now), { kind: 'trial_ending', endsAt: '2026-10-19T03:00:00Z', store: 'app_store' });
  assert.equal(billingNoticeOf(trial('2026-10-20T03:00:00Z'), now)?.kind, 'trial_ending');
  assert.equal(billingNoticeOf(trial('2026-10-20T03:00:01Z'), now), null);
  assert.equal(billingNoticeOf(trial('2026-10-18T02:59:00Z'), now), null);
  assert.equal(billingNoticeOf(trial('2026-10-19T03:00:00Z', true), now), null);
});

test('갱신 결제가 실패했으면 결제 수단 확인, 그 밖엔 없음', () => {
  assert.deepEqual(billingNoticeOf({ status: 'past_due', periodEnd: '2026-10-25T00:00:00Z', cancelAtPeriodEnd: false, store: 'play' }, now), { kind: 'past_due', store: 'play' });
  assert.equal(billingNoticeOf({ status: 'active', periodEnd: '2026-10-19T00:00:00Z', cancelAtPeriodEnd: false }, now), null);
  assert.equal(billingNoticeOf({ status: 'canceled', periodEnd: '2026-10-19T00:00:00Z', cancelAtPeriodEnd: true }, now), null);
  assert.equal(billingNoticeOf(null, now), null);
});
