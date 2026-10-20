import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durationLabel, funnelSteps, ratio, retentionTotal, revenueKrw } from '../admin-stats';

test('모수가 0이면 비율은 null', () => {
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(1, 4), 0.25);
});

test('퍼널은 가입 대비와 앞 단계 대비를 함께 낸다', () => {
  const steps = funnelSteps({ signups: 4, onboarded: 3, fed: 3, engaged: 2, returned: 1, paid: 2 });
  assert.deepEqual(
    steps.map((s) => [s.label, s.n, s.ofFirst, s.ofPrev]),
    [
      ['가입', 4, 1, null],
      ['온보딩', 3, 0.75, 0.75],
      ['첫 소식', 3, 0.75, 1],
      ['읽거나 들음', 2, 0.5, 2 / 3],
      ['다시 옴', 1, 0.25, 0.5],
    ],
  );
});

test('가입이 없으면 퍼널 비율은 모두 null', () => {
  const steps = funnelSteps({ signups: 0, onboarded: 0, fed: 0, engaged: 0, returned: 0, paid: 0 });
  assert.ok(steps.every((s) => s.ofFirst === null));
  assert.ok(steps.slice(1).every((s) => s.ofPrev === null));
});

test('재방문 합계는 주마다 사람과 모수를 더한다', () => {
  const row = (week: string, users: number, d1: number, d1Base: number) => ({ week, users, d1, d1Base, d7: 0, d7Base: 0, d30: 0, d30Base: 0 });
  assert.deepEqual(retentionTotal([row('2026-10-12', 1, 0, 1), row('2026-10-05', 2, 1, 2)]), {
    users: 3,
    d1: 1,
    d1Base: 3,
    d7: 0,
    d7Base: 0,
    d30: 0,
    d30Base: 0,
  });
});

test('매출은 원화에 달러를 환율로 더한다', () => {
  assert.equal(revenueKrw({ krw: 3800, usd: 2.5 }, 1400), 7300);
  assert.equal(revenueKrw({ krw: 0, usd: 0 }, 1400), 0);
});

test('걸린 시간은 분·시간·일로 줄인다', () => {
  assert.equal(durationLabel(null), '—');
  assert.equal(durationLabel(0.4), '1분 안');
  assert.equal(durationLabel(30), '30분');
  assert.equal(durationLabel(90), '2시간');
  assert.equal(durationLabel(2880), '2일');
});
