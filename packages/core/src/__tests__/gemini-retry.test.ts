import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callWithTimeout, GEMINI_MIN_REQUEST_MS, GeminiTimeoutError, requestTimeoutMs, retryDeadline, retryWaitMs } from '../ai/gemini';

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

test('요청 제한 시간: 마감이 없으면 기본값, 있으면 남은 시간과 둘 중 짧은 것, 5초도 안 남으면 부르지 않는다(null)', () => {
  assert.equal(requestTimeoutMs(60_000, NOW), 60_000);
  assert.equal(requestTimeoutMs(60_000, NOW, NOW + 200_000), 60_000);
  assert.equal(requestTimeoutMs(60_000, NOW, NOW + 41_000), 41_000);
  assert.equal(requestTimeoutMs(60_000, NOW, NOW + GEMINI_MIN_REQUEST_MS), GEMINI_MIN_REQUEST_MS);
  assert.equal(requestTimeoutMs(60_000, NOW, NOW + GEMINI_MIN_REQUEST_MS - 1), null);
  assert.equal(requestTimeoutMs(60_000, NOW, NOW - 1), null);
  // 제한도 마감도 없으면 끊지 않는다(화면에서 부르는 요청), 마감만 있으면 남은 시간까지
  assert.equal(requestTimeoutMs(null, NOW), Infinity);
  assert.equal(requestTimeoutMs(null, NOW, NOW + 41_000), 41_000);
});

test('기다렸다 다시 할 마감: retryUntil과 (마감 - 5초) 중 이른 것', () => {
  assert.equal(retryDeadline(), undefined);
  assert.equal(retryDeadline(NOW + 1000), NOW + 1000);
  assert.equal(retryDeadline(undefined, NOW + 60_000), NOW + 60_000 - GEMINI_MIN_REQUEST_MS);
  assert.equal(retryDeadline(NOW + 1000, NOW + 60_000), NOW + 1000);
  assert.equal(retryDeadline(NOW + 60_000, NOW + 30_000), NOW + 30_000 - GEMINI_MIN_REQUEST_MS);
  // 마감 근처면 429 기다림도 하지 않는다
  assert.equal(retryWaitMs(429, 20_000, 1, 5, NOW, retryDeadline(undefined, NOW + 20_000)), null);
});

test('시간 초과는 504로 보고 5xx와 같이 다시 시도한다(횟수·마감 규칙 그대로)', () => {
  const e = new GeminiTimeoutError('m', 60_000);
  assert.equal(e.status, 504);
  assert.equal(retryWaitMs(e.status, null, 1, 3, NOW), 2_000);
  assert.equal(retryWaitMs(e.status, null, 3, 3, NOW), null);
  assert.equal(retryWaitMs(e.status, null, 1, 3, NOW, NOW + 1_000), null);
});

test('callWithTimeout: 시간 안에 끝나면 결과를 주고, 넘으면 요청을 끊고(signal) GeminiTimeoutError', async () => {
  assert.equal(await callWithTimeout('m', 1_000, async () => 'ok'), 'ok');
  assert.equal(await callWithTimeout('m', Infinity, async () => 'no limit'), 'no limit');
  let seen: AbortSignal | null = null;
  const started = Date.now();
  await assert.rejects(
    callWithTimeout('m', 30, (signal) => {
      seen = signal;
      return new Promise(() => {}); // 끝나지 않는 요청(신호를 따르지 않아도 기다리지 않는다)
    }),
    (e: unknown) => e instanceof GeminiTimeoutError && e.timeoutMs === 30,
  );
  assert.ok(Date.now() - started < 1_000);
  assert.equal((seen as AbortSignal | null)?.aborted, true);
});

test('callWithTimeout: 신호를 따라 AbortError로 끝나도 시간 초과로, 다른 오류는 그대로', async () => {
  await assert.rejects(
    callWithTimeout('m', 20, (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))),
    GeminiTimeoutError,
  );
  const boom = Object.assign(new Error('busy'), { status: 503 });
  await assert.rejects(callWithTimeout('m', 1_000, async () => Promise.reject(boom)), (e: unknown) => e === boom);
});
