import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryWaitMs } from '../ai/gemini';

const NOW = 1_000_000;

test('Gemini 다시 시도: 429는 알려 준 만큼(최대 65초), 5xx는 2초부터 두 배씩(최대 30초)', () => {
  assert.equal(retryWaitMs(429, 20_000, 1, 5, NOW), 20_000);
  assert.equal(retryWaitMs(429, 120_000, 1, 5, NOW), 65_000);
  assert.equal(retryWaitMs(429, null, 1, 5, NOW), 15_000);
  assert.equal(retryWaitMs(503, null, 1, 5, NOW), 2_000);
  assert.equal(retryWaitMs(503, null, 3, 5, NOW), 8_000);
  assert.equal(retryWaitMs(500, null, 9, 10, NOW), 30_000);
});

test('다시 해도 소용없는 오류와 횟수를 다 쓴 때는 다시 하지 않는다', () => {
  assert.equal(retryWaitMs(400, null, 1, 5, NOW), null);
  assert.equal(retryWaitMs(0, null, 1, 5, NOW), null);
  // 배송 경로는 처음 + 다시 두 번(maxAttempts 3)
  assert.ok(retryWaitMs(429, 10_000, 2, 3, NOW));
  assert.equal(retryWaitMs(429, 10_000, 3, 3, NOW), null);
});

test('기다리면 마감(retryUntil)을 넘기면 다시 하지 않는다', () => {
  assert.equal(retryWaitMs(429, 65_000, 1, 3, NOW, NOW + 60_000), null);
  assert.equal(retryWaitMs(429, 30_000, 1, 3, NOW, NOW + 60_000), 30_000);
  assert.equal(retryWaitMs(503, null, 1, 3, NOW, NOW + 1_000), null);
});
