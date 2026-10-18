import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reinsert } from '../undo';

test('reinsert: 뺀 자리 그대로 돌려놓는다', () => {
  assert.deepEqual(reinsert([1, 3, 4], 2, [1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.deepEqual(reinsert([2, 3], 1, [1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(reinsert([1, 2], 3, [1, 2, 3]), [1, 2, 3]);
});

test('reinsert: 이미 있으면 겹치지 않는다', () => {
  assert.deepEqual(reinsert([1, 2, 3], 2, [1, 2, 3]), [1, 2, 3]);
});

test('reinsert: 그사이 앞 항목이 빠졌으면 그 앞에 남은 항목 뒤로', () => {
  // 2를 뺀 뒤 1도 빠졌다 → 맨 앞으로
  assert.deepEqual(reinsert([3, 4], 2, [1, 2, 3, 4]), [2, 3, 4]);
  // 3을 뺀 뒤 2가 빠졌다 → 1 뒤로
  assert.deepEqual(reinsert([1, 4], 3, [1, 2, 3, 4]), [1, 3, 4]);
});

test('reinsert: 그사이 끝에 더해진 항목이 있어도 원래 자리로', () => {
  assert.deepEqual(reinsert([1, 3, 9], 2, [1, 2, 3]), [1, 2, 3, 9]);
  assert.deepEqual(reinsert([1, 2, 9], 3, [1, 2, 3]), [1, 2, 3, 9]);
});

test('reinsert: 그사이 순서가 바뀌었으면 앞에 있던 항목 바로 뒤', () => {
  assert.deepEqual(reinsert([3, 1], 2, [1, 2, 3]), [3, 1, 2]);
});

test('reinsert: 기준이 없으면 null(모르는 항목, 전혀 다른 목록)', () => {
  assert.equal(reinsert([1, 2], 7, [1, 2, 3]), null);
  assert.equal(reinsert([8, 9], 2, [1, 2, 3]), null);
  assert.deepEqual(reinsert([], 2, [2]), [2]);
});
