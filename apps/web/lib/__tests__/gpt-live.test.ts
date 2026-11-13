import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gptLive, PRIVACY_EFFECTIVE_ON } from '../site';

test('GPT 표시·OpenAI 사용은 처리방침 시행일(한국 날짜)부터', () => {
  const [y, m, d] = PRIVACY_EFFECTIVE_ON.split('-').map(Number);
  // 시행일 0시(KST) = 전날 15시(UTC)
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 3600_000;
  assert.equal(gptLive(new Date(startUtc - 1000)), false, '시행일 전날 23:59:59(KST)');
  assert.equal(gptLive(new Date(startUtc)), true, '시행일 0시(KST)');
  assert.equal(gptLive(new Date(startUtc + 30 * 86400_000)), true, '시행 뒤');
});
