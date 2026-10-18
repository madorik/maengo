import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keptIds, parseRemoved, planTodaySwap, sameIds } from '../removed';

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

test('planTodaySwap: 듣는 중에 빼면 지금 받은 목록에서만 뺀다(그사이 피드에 새로 온 소식은 넣지 않는다)', () => {
  // 10·20·30으로 듣기 시작했고, 듣는 동안 피드에 40이 왔다
  const plan = planTodaySwap([10, 20, 30], [10, 20, 30], [10, 20, 30, 40], new Set([20]));
  assert.deepEqual(plan, { ids: [10, 30], synced: false });
});

test('planTodaySwap: 피드가 그대로면 화면 목록과 같아진다', () => {
  assert.deepEqual(planTodaySwap([10, 20, 30], [10, 20, 30], [10, 20, 30], new Set([30])), { ids: [10, 20], synced: true });
});

test('planTodaySwap: 되돌리기는 받은 목록에 있던 소식만 다시 넣는다', () => {
  // 20은 듣는 중에 뺐고(음성 있음), 5는 듣기 전에 빼 둔 소식(음성이 없을 수 있다)
  const plan = planTodaySwap([10, 20, 30], [10, 30], [5, 10, 20, 30], new Set());
  assert.deepEqual(plan, { ids: [10, 20, 30], synced: false });
});

test('planTodaySwap: 지금 목록과 같으면 갈아 끼우지 않는다', () => {
  // 플레이어에 없는 소식(듣는 동안 새로 온 40)을 빼면 플레이어 목록은 그대로
  assert.deepEqual(planTodaySwap([10, 20], [10, 20], [10, 20, 40], new Set([40])), { ids: null, synced: true });
  // 듣기 전에 빼 둔 소식만 되돌리면 그대로(듣기가 끝나면 다시 받는다)
  assert.deepEqual(planTodaySwap([10, 20], [10, 20], [5, 10, 20], new Set()), { ids: null, synced: false });
});

test('planTodaySwap: 다 빼면 빈 목록', () => {
  assert.deepEqual(planTodaySwap([10, 20], [10, 20], [10, 20], new Set([10, 20])), { ids: [], synced: true });
});

test('sameIds: 순서까지 같아야 같다', () => {
  assert.equal(sameIds([1, 2], [1, 2]), true);
  assert.equal(sameIds([1, 2], [2, 1]), false);
  assert.equal(sameIds([1], [1, 2]), false);
  assert.equal(sameIds([], []), true);
});
