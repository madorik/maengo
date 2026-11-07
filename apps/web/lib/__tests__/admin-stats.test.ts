import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type SummaryStats, durationLabel, funnelSteps, ratio, retentionTotal, revenueKrw, summarySeries, summaryTotals } from '../admin-stats';

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

const day = (date: string, v: Partial<SummaryStats['daily'][number]> = {}): SummaryStats['daily'][number] => ({
  date, visitors: 0, signups: 0, newSubs: 0, trials: 0, subs: 0, krw: 0, usd: 0, costUsd: 0, ...v,
});

const summary: SummaryStats = {
  firstVisit: '2026-11-07',
  base: { users: 10, krw: 3800, usd: 1, costUsd: 2 },
  daily: [
    day('2026-11-06', { signups: 2, newSubs: 1, subs: 1, krw: 3800, costUsd: 0.1 }),
    day('2026-11-07', { visitors: 20, signups: 1, subs: 1, usd: 2.5, costUsd: 0.2 }),
    day('2026-11-08', { visitors: 30, signups: 3, trials: 1, subs: 2, costUsd: 0.05 }),
  ],
};

test('요약: 누적은 base에 날마다 더하고 달러는 환율로', () => {
  const days = summarySeries(summary, 1400);
  assert.deepEqual(days.map((d) => d.users), [12, 13, 16]);
  assert.deepEqual(days.map((d) => d.revenue), [3800, 3500, 0]);
  assert.deepEqual(days.map((d) => d.revenueTotal), [3800 + 1400 + 3800, 3800 + 1400 + 3800 + 3500, 3800 + 1400 + 3800 + 3500]);
  assert.deepEqual(days.map((d) => d.cost), [140, 280, 70]);
  assert.deepEqual(days.map((d) => d.costTotal), [2800 + 140, 2800 + 420, 2800 + 490]);
});

test('요약: 전환율은 방문자를 센 날부터, 전체 값은 기간 마지막 날', () => {
  const days = summarySeries(summary, 1400);
  const all = summaryTotals(days, { from: '2026-11-06', to: '2026-11-08' }, summary.firstVisit);
  assert.equal(all.signups, 6);
  assert.equal(all.trackedSignups, 4);
  assert.equal(all.visitors, 50);
  assert.equal(all.conversion, 4 / 50);
  assert.equal(all.users, 16);
  assert.equal(all.newSubs, 1);
  assert.equal(all.trials, 1);
  assert.equal(all.subs, 2);
  assert.equal(all.revenue, 7300);
  const one = summaryTotals(days, { from: '2026-11-06', to: '2026-11-06' }, summary.firstVisit);
  assert.equal(one.conversion, null);
  assert.equal(one.users, 12);
  assert.equal(summaryTotals(days, { from: '2026-11-08', to: '2026-11-08' }, null).conversion, null);
});
