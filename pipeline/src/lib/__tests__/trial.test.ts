import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kstDayRange, trialEndMessage } from '../trial';

test('한국 날짜 하루의 범위(UTC로)', () => {
  assert.deepEqual(kstDayRange('2026-10-19'), { from: '2026-10-18T15:00:00.000Z', to: '2026-10-19T15:00:00.000Z' });
  // 달이 넘어가도
  assert.deepEqual(kstDayRange('2026-10-31'), { from: '2026-10-30T15:00:00.000Z', to: '2026-10-31T15:00:00.000Z' });
});

test('체험 끝 알림: 결제 날짜는 한국 날짜로, 금액을 알면 넣는다', () => {
  // UTC로는 19일 16시지만 한국은 20일 새벽 1시
  const m = trialEndMessage('2026-10-19T16:00:00Z', '₩3,800');
  assert.equal(m.title, '내일 무료 체험이 끝나요');
  assert.equal(m.body, '10월 20일에 Premium 첫 결제(₩3,800)가 진행돼요');
  assert.equal(m.path, '/settings#plan');
  assert.equal(trialEndMessage('2026-10-20T03:00:00Z', null).body, '10월 20일에 Premium 첫 결제가 진행돼요');
});
