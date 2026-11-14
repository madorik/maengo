import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAskRef } from '../ask';

test('물어보기 대상: 글은 소식 번호, 흐름은 날짜·때·차례만 받는다', () => {
  assert.deepEqual(parseAskRef({ clusterId: 123 }), { clusterId: 123 });
  assert.deepEqual(parseAskRef({ clusterId: '123' }), { clusterId: 123 });
  assert.deepEqual(parseAskRef({ flow: { date: '2026-11-14', slot: 'pm', index: 2 } }), { flow: { date: '2026-11-14', slot: 'pm', index: 2 } });
  // 흐름이 있으면 흐름으로(같이 온 소식 번호는 무시), 다른 칸은 버린다
  assert.deepEqual(parseAskRef({ clusterId: 1, flow: { date: '2026-11-14', slot: 'am', index: 0, text: '지시' } }), { flow: { date: '2026-11-14', slot: 'am', index: 0 } });
});

test('물어보기 대상: 이상한 값은 거른다', () => {
  for (const bad of [null, {}, { clusterId: null }, { clusterId: 1.5 }, { clusterId: 'abc' }]) assert.equal(parseAskRef(bad), null);
  for (const flow of [
    { date: '2026-11-14', slot: 'night', index: 0 },
    { date: '11월 14일', slot: 'am', index: 0 },
    { date: '2026-11-14', slot: 'am', index: -1 },
    { date: '2026-11-14', slot: 'am', index: 10 },
    { date: '2026-11-14', slot: 'am', index: '1' },
  ])
    assert.equal(parseAskRef({ flow }), null);
});
