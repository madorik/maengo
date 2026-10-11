import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminPresets, parseAdminRange, spanDays } from '../admin-range';

const today = '2026-10-11';

test('기간이 없으면 오늘까지 14일', () => {
  assert.deepEqual(parseAdminRange({}, today), { from: '2026-09-28', to: today });
});

test('to만 주면 그날까지 14일', () => {
  assert.deepEqual(parseAdminRange({ to: '2026-10-01' }, today), { from: '2026-09-18', to: '2026-10-01' });
});

test('잘못된 날짜는 버린다', () => {
  assert.deepEqual(parseAdminRange({ from: '2026-02-30', to: 'x' }, today), { from: '2026-09-28', to: today });
  assert.deepEqual(parseAdminRange({ from: ['2026-10-01'] }, today), { from: '2026-09-28', to: today });
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
