import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminHref, adminPresets, parseAdminRange, parseAdminTab, spanDays, trendRange } from '../admin-range';

const today = '2026-10-11';

test('기간이 없으면 오늘 하루', () => {
  assert.deepEqual(parseAdminRange({}, today), { from: today, to: today });
});

test('to만 주면 그날 하루', () => {
  assert.deepEqual(parseAdminRange({ to: '2026-10-01' }, today), { from: '2026-10-01', to: '2026-10-01' });
});

test('잘못된 날짜는 버린다', () => {
  assert.deepEqual(parseAdminRange({ from: '2026-02-30', to: 'x' }, today), { from: today, to: today });
  assert.deepEqual(parseAdminRange({ from: ['2026-10-01'] }, today), { from: today, to: today });
});

test('앞뒤가 바뀌면 바꾼다', () => {
  assert.deepEqual(parseAdminRange({ from: '2026-10-05', to: '2026-10-01' }, today), { from: '2026-10-01', to: '2026-10-05' });
});

test('오늘 뒤는 오늘로', () => {
  assert.deepEqual(parseAdminRange({ from: '2026-10-05', to: '2026-12-01' }, today), { from: '2026-10-05', to: today });
  assert.deepEqual(parseAdminRange({ from: '2026-11-01', to: '2026-12-01' }, today), { from: today, to: today });
});

test('너무 긴 기간은 to에서 366일', () => {
  const r = parseAdminRange({ from: '2020-01-01', to: '2026-10-01' }, today);
  assert.equal(r.to, '2026-10-01');
  assert.equal(spanDays(r), 366);
});

test('빠른 기간', () => {
  const p = Object.fromEntries(adminPresets(today).map((x) => [x.label, x]));
  assert.deepEqual(p['오늘'], { label: '오늘', from: today, to: today });
  assert.equal(spanDays(p['7일']), 7);
  assert.equal(p['이번 달'].from, '2026-10-01');
});

test('탭은 모르는 값이면 요약', () => {
  assert.equal(parseAdminTab({}), 'summary');
  assert.equal(parseAdminTab({ tab: 'growth' }), 'growth');
  assert.equal(parseAdminTab({ tab: 'revenue' }), 'revenue');
  assert.equal(parseAdminTab({ tab: 'ops' }), 'ops');
  assert.equal(parseAdminTab({ tab: 'x' }), 'summary');
  assert.equal(parseAdminTab({ tab: ['ops'] }), 'summary');
});

test('탭 주소는 기간을 담고, 요약 탭은 tab을 뺀다', () => {
  const range = { from: '2026-10-01', to: '2026-10-11' };
  assert.equal(adminHref('summary', range), '/admin?from=2026-10-01&to=2026-10-11');
  assert.equal(adminHref('growth', range), '/admin?tab=growth&from=2026-10-01&to=2026-10-11');
  assert.equal(adminHref('ops', range), '/admin?tab=ops&from=2026-10-01&to=2026-10-11');
});

test('요약 추이는 짧은 기간이면 끝날까지 30일, 긴 기간이면 그대로', () => {
  assert.deepEqual(trendRange({ from: today, to: today }), { from: '2026-09-12', to: today });
  assert.deepEqual(trendRange({ from: '2026-10-05', to: '2026-10-07' }), { from: '2026-09-08', to: '2026-10-07' });
  assert.deepEqual(trendRange({ from: '2026-08-01', to: today }), { from: '2026-08-01', to: today });
});
