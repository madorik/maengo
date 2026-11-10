import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveHref, archivePresets, kstToday, pageWindow, parseArchiveQuery, rangeLabel } from '../public-archive';

const today = '2026-11-10'; // 화요일

test('잘못된 쪽·날짜는 버린다', () => {
  assert.deepEqual(parseArchiveQuery({ page: '0', from: '2026-02-31', to: 'x' }), { page: 1, from: undefined, to: undefined });
  assert.deepEqual(parseArchiveQuery({ page: '-3' }), { page: 1, from: undefined, to: undefined });
  assert.deepEqual(parseArchiveQuery({ page: ['3', '4'] }), { page: 3, from: undefined, to: undefined });
});

test('시작일이 끝 날보다 늦으면 바꾼다', () => {
  assert.deepEqual(parseArchiveQuery({ from: '2026-11-05', to: '2026-11-01' }), { page: 1, from: '2026-11-01', to: '2026-11-05' });
});

test('주소: 1쪽은 page를 빼고 기간은 앞에', () => {
  assert.equal(archiveHref('/topics/ai/archive', { page: 1 }), '/topics/ai/archive');
  assert.equal(archiveHref('/topics/ai/archive', { page: 2, from: '2026-11-01' }), '/topics/ai/archive?from=2026-11-01&page=2');
});

test('빠른 기간: 이번 주는 월요일부터, 지난달은 1일~말일', () => {
  const [all, week, month, last] = archivePresets(today);
  assert.deepEqual(all, { label: '전체' });
  assert.deepEqual(week, { label: '이번 주', from: '2026-11-09' });
  assert.deepEqual(month, { label: '이번 달', from: '2026-11-01' });
  assert.deepEqual(last, { label: '지난달', from: '2026-10-01', to: '2026-10-31' });
  assert.equal(archivePresets('2026-11-09')[1]!.from, '2026-11-09'); // 월요일은 그날부터
  assert.equal(archivePresets('2026-11-15')[1]!.from, '2026-11-09'); // 일요일은 그 주 월요일부터
  assert.deepEqual(archivePresets('2026-03-02')[3], { label: '지난달', from: '2026-02-01', to: '2026-02-28' });
});

test('기간 이름', () => {
  assert.equal(rangeLabel({ page: 1 }, today), null);
  assert.equal(rangeLabel({ page: 1, from: '2026-11-01', to: '2026-11-10' }, today), '11월 1일 ~ 11월 10일');
  assert.equal(rangeLabel({ page: 1, from: '2025-12-30' }, today), '2025년 12월 30일부터');
  assert.equal(rangeLabel({ page: 1, from: '2026-11-03', to: '2026-11-03' }, today), '11월 3일');
});

test('쪽 번호 줄', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 7), [1, 2, 3, null, 7]);
  assert.deepEqual(pageWindow(6, 20), [1, null, 4, 5, 6, 7, 8, null, 20]);
  assert.deepEqual(pageWindow(4, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('한국 날짜: UTC 15시면 다음 날', () => {
  assert.equal(kstToday(Date.parse('2026-11-09T15:00:00Z')), '2026-11-10');
  assert.equal(kstToday(Date.parse('2026-11-09T14:59:59Z')), '2026-11-09');
});
