import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kstDayRange, TRIAL_PUSH_MS, TRIAL_RETRY_WAITS_MS, trialEndMessage, trialMayStart, trialNextStep } from '../trial';

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

const T0 = 1_000_000;

test('체험 끝 알림: 마감까지 한 번 보낼 시간(30초)이 있을 때만 새로 가져간다', () => {
  assert.equal(trialMayStart(T0, T0 + TRIAL_PUSH_MS), true);
  assert.equal(trialMayStart(T0, T0 + TRIAL_PUSH_MS - 1), false);
  assert.equal(trialMayStart(T0, T0 - 1), false);
});

test('체험 끝 알림: 보냄·기기 없음·다시 해도 같은 실패·알림 꺼 둠이면 끝', () => {
  const far = T0 + 10 * 60_000;
  for (const status of ['sent', 'no_device', 'error', 'muted']) assert.deepEqual(trialNextStep(status, 0, T0, far), { do: 'done' });
});

test('체험 끝 알림: 잠깐의 실패면 3초 → 10초 기다렸다 다시, 두 번 다 쓰면 끝(결과는 retry로 남는다)', () => {
  const far = T0 + 10 * 60_000;
  assert.deepEqual(trialNextStep('retry', 0, T0, far), { do: 'wait', ms: TRIAL_RETRY_WAITS_MS[0] });
  assert.deepEqual(trialNextStep('retry', 1, T0, far), { do: 'wait', ms: TRIAL_RETRY_WAITS_MS[1] });
  assert.deepEqual(trialNextStep('retry', 2, T0, far), { do: 'done' });
});

test('체험 끝 알림: 기다렸다 다시 보낼 시간이 없으면 놓아준다(다음 실행이 처음부터, 알림이 사라지지 않게)', () => {
  const need = TRIAL_RETRY_WAITS_MS[0]! + TRIAL_PUSH_MS;
  assert.deepEqual(trialNextStep('retry', 0, T0, T0 + need), { do: 'wait', ms: TRIAL_RETRY_WAITS_MS[0] });
  assert.deepEqual(trialNextStep('retry', 0, T0, T0 + need - 1), { do: 'later' });
  assert.deepEqual(trialNextStep('retry', 1, T0, T0 + TRIAL_RETRY_WAITS_MS[1]! + TRIAL_PUSH_MS - 1), { do: 'later' });
  // 다시 보내기를 다 썼으면 시간과 상관없이 끝
  assert.deepEqual(trialNextStep('retry', 2, T0, T0), { do: 'done' });
});
