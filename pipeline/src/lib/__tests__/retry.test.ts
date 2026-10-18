import assert from 'node:assert/strict';
import { test } from 'node:test';
import { afterTaskFailure, afterTaskSuccess, anchoredNext, DELIVERY_BUILT_BY, existingFeedResult, isInactive, sendRetryAt, TASK_RETRIES } from '../retry';

const kst = (s: string) => new Date(`${s}+09:00`);

test('푸시 다시 보내기: 1분 → 5분 → 15분, 그 뒤엔 그만', () => {
  const now = kst('2026-10-18T08:00:00');
  assert.equal(sendRetryAt(1, now, '2026-10-18')?.toISOString(), kst('2026-10-18T08:01:00').toISOString());
  assert.equal(sendRetryAt(2, now, '2026-10-18')?.toISOString(), kst('2026-10-18T08:05:00').toISOString());
  assert.equal(sendRetryAt(3, now, '2026-10-18')?.toISOString(), kst('2026-10-18T08:15:00').toISOString());
  assert.equal(sendRetryAt(4, now, '2026-10-18'), null);
});

test('푸시 다시 보내기: 다시 보낼 때 그 소식 날짜(KST)가 지나 있으면 보내지 않는다', () => {
  assert.equal(sendRetryAt(2, kst('2026-10-18T23:57:00'), '2026-10-18'), null);
  assert.ok(sendRetryAt(1, kst('2026-10-18T23:57:00'), '2026-10-18'));
  // 이미 어제 줄이면 바로 그만
  assert.equal(sendRetryAt(1, kst('2026-10-19T00:10:00'), '2026-10-18'), null);
});

test('오래 안 온 사람: 마지막으로 연 지 7일 이상. 연 기록이 없으면 가입 시각, 둘 다 없으면 활동 중', () => {
  const now = kst('2026-10-18T08:00:00');
  assert.equal(isInactive(kst('2026-10-11T08:00:00').toISOString(), null, now), true);
  assert.equal(isInactive(kst('2026-10-11T08:00:01').toISOString(), null, now), false);
  assert.equal(isInactive(null, kst('2026-10-01T00:00:00').toISOString(), now), true);
  assert.equal(isInactive(null, kst('2026-10-17T00:00:00').toISOString(), now), false);
  // 최근에 열었으면 가입이 오래돼도 활동 중
  assert.equal(isInactive(kst('2026-10-17T00:00:00').toISOString(), kst('2026-01-01T00:00:00').toISOString(), now), false);
  assert.equal(isInactive(null, null, now), false);
  assert.equal(isInactive('이상한 값', undefined, now), false);
});

test('원래 차례에 맞춘 다음 시각: 06:00 기준 하루 주기', () => {
  const anchor = kst('2026-10-18T06:00:00').toISOString();
  assert.equal(anchoredNext(anchor, 1440, kst('2026-10-18T06:00:30')).toISOString(), kst('2026-10-19T06:00:00').toISOString());
  assert.equal(anchoredNext(anchor, 1440, kst('2026-10-18T07:31:00')).toISOString(), kst('2026-10-19T06:00:00').toISOString());
  // 며칠 밀렸으면 지난 차례는 건너뛴다
  assert.equal(anchoredNext(anchor, 1440, kst('2026-10-20T09:00:00')).toISOString(), kst('2026-10-21T06:00:00').toISOString());
});

const ingest = (over: Partial<Parameters<typeof afterTaskFailure>[0]> = {}) => ({
  every_minutes: 1440,
  next_run_at: kst('2026-10-18T06:00:00').toISOString(),
  last_status: 'ok',
  last_stats: { collect: {} },
  ...over,
});

test('06:00 수집이 실패하면 30분 뒤 다시(내일 06:00이 아니라)', () => {
  const now = kst('2026-10-18T06:02:00');
  const { nextRunAt, state } = afterTaskFailure(ingest(), now);
  assert.equal(nextRunAt.toISOString(), kst('2026-10-18T06:32:00').toISOString());
  assert.deepEqual(state, { failDate: '2026-10-18', fails: 1, anchor: kst('2026-10-18T06:00:00').toISOString(), retryAt: nextRunAt.toISOString() });
});

test('실패를 이어 세고, 하루 세 번 다시 한 뒤엔 원래 차례(다음 날 06:00)로', () => {
  let task = ingest();
  let now = kst('2026-10-18T06:02:00');
  for (let i = 1; i <= TASK_RETRIES; i++) {
    const r = afterTaskFailure(task, now);
    assert.equal(r.state.fails, i);
    assert.ok(r.state.retryAt, `${i}번째 실패 뒤 다시`);
    task = { ...task, last_status: 'failed', last_stats: r.state, next_run_at: r.nextRunAt.toISOString() };
    now = new Date(r.nextRunAt.getTime() + 60_000);
  }
  const last = afterTaskFailure(task, now);
  assert.equal(last.state.fails, TASK_RETRIES + 1);
  assert.equal(last.state.retryAt, null);
  // 다시 시도로 시각을 당겨도 원래 06:00에 맞춘다
  assert.equal(last.nextRunAt.toISOString(), kst('2026-10-19T06:00:00').toISOString());
});

test('다음 날 다시 실패하면 그날 횟수는 처음부터', () => {
  const prev = { failDate: '2026-10-18', fails: 4, anchor: kst('2026-10-18T06:00:00').toISOString(), retryAt: null };
  const r = afterTaskFailure(ingest({ last_status: 'failed', last_stats: prev, next_run_at: kst('2026-10-19T06:00:00').toISOString() }), kst('2026-10-19T06:01:00'));
  assert.equal(r.state.fails, 1);
  assert.equal(r.nextRunAt.toISOString(), kst('2026-10-19T06:31:00').toISOString());
});

test('주기가 짧은 작업은 원래 차례가 더 빨라 그대로 둔다', () => {
  const r = afterTaskFailure({ every_minutes: 5, next_run_at: kst('2026-10-18T06:00:00').toISOString(), last_status: null, last_stats: null }, kst('2026-10-18T06:01:00'));
  assert.equal(r.state.retryAt, null);
  assert.equal(r.nextRunAt.toISOString(), kst('2026-10-18T06:05:00').toISOString());
});

test('다시 시도하다 성공하면 원래 시각으로 되돌리고, 평소 성공이면 finish_scheduler_task에 맡긴다', () => {
  const prev = { failDate: '2026-10-18', fails: 2, anchor: kst('2026-10-18T06:00:00').toISOString(), retryAt: kst('2026-10-18T07:02:00').toISOString() };
  const next = afterTaskSuccess(ingest({ last_status: 'failed', last_stats: prev, next_run_at: prev.retryAt }), kst('2026-10-18T07:05:00'));
  assert.equal(next?.toISOString(), kst('2026-10-19T06:00:00').toISOString());
  assert.equal(afterTaskSuccess(ingest(), kst('2026-10-18T06:05:00')), null);
  // 예전 형식의 실패 기록(last_stats null)은 이어 세지 않는다
  assert.equal(afterTaskSuccess(ingest({ last_status: 'failed', last_stats: null }), kst('2026-10-18T06:05:00')), null);
});

test('이미 있는 오늘 피드: 배송이 만든 것(delivery)이면 멈춘 배송이라 이어서 알린다', () => {
  assert.equal(DELIVERY_BUILT_BY, 'delivery');
  assert.equal(existingFeedResult('delivery', 1), 'built');
  assert.equal(existingFeedResult('delivery', 3), 'built');
});

test('이미 있는 오늘 피드: 화면에서 받은 것(web)이나 모르는 표시는 알리지 않는다', () => {
  assert.equal(existingFeedResult('web', 1), 'had');
  assert.equal(existingFeedResult('web', 3), 'had');
  assert.equal(existingFeedResult('something', 3), 'had');
});

test("이미 있는 오늘 피드: 'pipeline'(열 기본값)은 이 줄을 전에 가져간 적이 있을 때만 멈춘 배송(표시 전 배송 피드)으로 본다", () => {
  // 처음 가져간 줄이면 배송이 만들었을 수 없다(손으로 돌린 rank 등)
  assert.equal(existingFeedResult('pipeline', 1), 'had');
  assert.equal(existingFeedResult('pipeline', 0), 'had');
  assert.equal(existingFeedResult('pipeline', 2), 'built');
});
