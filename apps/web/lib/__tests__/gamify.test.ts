import assert from 'node:assert/strict';
import { test } from 'node:test';
import { xpToday } from '../gamify';

test('XP: 읽거나 들은 항목 10, 의견 5', () => {
  const consumed = new Set([1, 2]);
  assert.equal(xpToday([1, 2, 3], (id) => consumed.has(id), { 2: 'more', 3: 'skip' }), 30);
});
