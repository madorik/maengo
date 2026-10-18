import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverySpike, opsAlerts, type OpsInput, type TaskState } from '../admin-ops';

const kst = (s: string) => new Date(`${s}+09:00`);
const iso = (s: string) => kst(s).toISOString();
const NOW = kst('2026-10-18T09:00:00');

const task = (over: Partial<TaskState> = {}): TaskState => ({
  enabled: true,
  nextRunAt: null,
  runningSince: null,
  lastFinishedAt: iso('2026-10-18T08:59:30'),
  lastStatus: 'ok',
  lastError: null,
  lastStats: null,
  ...over,
});

const base = (over: Partial<OpsInput> = {}): OpsInput => ({
  now: NOW,
  deliveries: task(),
  ingest: task({ enabled: true, lastFinishedAt: iso('2026-10-18T06:03:00'), nextRunAt: iso('2026-10-19T06:00:00') }),
  today: { total: 20, failed: 0, noDevice: 1 },
  noDeviceAvg: 1,
  ...over,
});

const titles = (input: OpsInput) => opsAlerts(input).map((a) => a.title);

test('다 잘 돌면 빨간 줄이 없다', () => {
  assert.deepEqual(titles(base()), []);
});

test('배송이 5분 넘게 안 끝났으면(돌고 있지도 않으면) 알린다', () => {
  assert.deepEqual(titles(base({ deliveries: task({ lastFinishedAt: iso('2026-10-18T08:54:00') }) })), ['소식 지급·알림이 5분 넘게 돌지 않았어요']);
  // 지금 도는 중(5분 안에 시작)이면 기다린다
  assert.deepEqual(titles(base({ deliveries: task({ lastFinishedAt: iso('2026-10-18T08:54:00'), runningSince: iso('2026-10-18T08:57:00') }) })), []);
  // 5분 넘게 붙잡고 있으면 멈춘 것
  assert.equal(titles(base({ deliveries: task({ lastFinishedAt: iso('2026-10-18T08:40:00'), runningSince: iso('2026-10-18T08:41:00') }) })).length, 1);
  assert.equal(titles(base({ deliveries: task({ lastFinishedAt: null }) })).length, 1);
  assert.deepEqual(titles(base({ deliveries: task({ lastStatus: 'failed', lastError: 'x' }) })), ['소식 지급·알림 마지막 실행이 실패했어요']);
});

test('오늘 수집이 실패했으면 몇 번째인지와 다시 할 시각을 알린다', () => {
  const failed = task({ lastStatus: 'failed', lastFinishedAt: iso('2026-10-18T06:32:00'), lastError: 'collect: 타임아웃', lastStats: { fails: 2, retryAt: iso('2026-10-18T07:02:00') } });
  const [a] = opsAlerts(base({ ingest: failed }));
  assert.equal(a?.title, '오늘 수집이 실패했어요(2번)');
  assert.match(a!.detail, /collect: 타임아웃/);
  assert.match(a!.detail, /다시 해요/);
  const gaveUp = opsAlerts(base({ ingest: { ...failed, lastStats: { fails: 4, retryAt: null } } }));
  assert.match(gaveUp[0]!.detail, /더 다시 하지 않아요/);
  // 어제 실패는 오늘 실패가 아니다(07시 넘어 오늘 안 돌았으면 그쪽으로 알린다)
  assert.deepEqual(titles(base({ ingest: { ...failed, lastFinishedAt: iso('2026-10-17T06:32:00') } })), ['오늘 수집이 아직 안 돌았어요']);
});

test('07시가 넘도록 오늘 수집이 안 돌았으면 알린다. 꺼 둔 작업은 보지 않는다', () => {
  const stale = task({ lastFinishedAt: iso('2026-10-17T06:03:00') });
  assert.deepEqual(titles(base({ ingest: stale })), ['오늘 수집이 아직 안 돌았어요']);
  assert.deepEqual(titles(base({ now: kst('2026-10-18T06:30:00'), deliveries: task({ lastFinishedAt: iso('2026-10-18T06:29:30') }), ingest: stale })), []);
  assert.deepEqual(titles(base({ ingest: { ...stale, runningSince: iso('2026-10-18T08:58:00') } })), []);
  assert.deepEqual(titles(base({ ingest: { ...stale, enabled: false } })), []);
});

test('실패·기기 없음이 몰리면 알린다', () => {
  assert.deepEqual(deliverySpike({ total: 20, failed: 1, noDevice: 2 }, 1), { failed: false, noDevice: false });
  assert.deepEqual(deliverySpike({ total: 20, failed: 2, noDevice: 3 }, 1), { failed: true, noDevice: true });
  // 많이 보내는 날은 10%까지 봐준다
  assert.equal(deliverySpike({ total: 100, failed: 9, noDevice: 0 }, 0).failed, false);
  assert.equal(deliverySpike({ total: 100, failed: 10, noDevice: 0 }, 0).failed, true);
  // 평소에도 기기 없음이 많으면 두 배가 되어야
  assert.equal(deliverySpike({ total: 100, failed: 0, noDevice: 15 }, 10).noDevice, false);
  assert.equal(deliverySpike({ total: 100, failed: 0, noDevice: 20 }, 10).noDevice, true);
  assert.deepEqual(titles(base({ today: { total: 20, failed: 3, noDevice: 5 } })), ['오늘 소식 지급 실패가 3건이에요', "오늘 '기기 없음'이 평소보다 많아요(5건)"]);
});
