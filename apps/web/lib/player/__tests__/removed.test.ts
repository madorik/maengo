import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keptIds, parseRemoved } from '../removed';

test('parseRemoved: 그날 것만 읽는다', () => {
  const raw = JSON.stringify({ date: '2026-10-18', ids: [3, 5] });
  assert.deepEqual([...parseRemoved(raw, '2026-10-18')], [3, 5]);
  assert.equal(parseRemoved(raw, '2026-10-19').size, 0);
});

test('parseRemoved: 비었거나 깨진 값은 뺀 것 없음', () => {
  assert.equal(parseRemoved(null, '2026-10-18').size, 0);
  assert.equal(parseRemoved('{', '2026-10-18').size, 0);
  assert.equal(parseRemoved(JSON.stringify({ date: '2026-10-18', ids: 'x' }), '2026-10-18').size, 0);
  assert.deepEqual([...parseRemoved(JSON.stringify({ date: '2026-10-18', ids: [1, -2, 2.5, '3', 4] }), '2026-10-18')], [1, 4]);
});

test('keptIds: 화면 순서를 지키며 뺀 소식만 뺀다', () => {
  assert.deepEqual(keptIds([10, 20, 30, 40], new Set([20, 40])), [10, 30]);
  assert.deepEqual(keptIds([10, 20], new Set()), [10, 20]);
  assert.deepEqual(keptIds([10, 20], new Set([10, 20])), []);
});
