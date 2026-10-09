import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Chapter } from '@maengo/core/types';
import { chapterAt, lineAt, nextPlayable, progress, startIndex, tick } from '../machine';

// 10초짜리 챕터 5개. clusterId = 101~105
const chapters: Chapter[] = [0, 1, 2, 3, 4].map((i) => ({
  rank: i + 1,
  clusterId: 101 + i,
  title: `t${i + 1}`,
  startMs: i * 10_000,
  endMs: (i + 1) * 10_000,
  lines: [
    { text: 'a', startMs: i * 10_000 + 400, endMs: i * 10_000 + 4000 },
    { text: 'b', startMs: i * 10_000 + 4500, endMs: i * 10_000 + 9000 },
  ],
}));
const none = new Set<number>();
const on = { autoNext: true, skipRead: false };

test('챕터 위치 계산', () => {
  assert.equal(chapterAt(chapters, 0), 0);
  assert.equal(chapterAt(chapters, 9_999), 0);
  assert.equal(chapterAt(chapters, 10_000), 1);
  assert.equal(chapterAt(chapters, 50_000), 5);
});

test('자동 재생이 켜져 있으면 다음 챕터로 들어선다', () => {
  assert.deepEqual(tick(chapters, 0, 5_000, none, on), { kind: 'none' });
  assert.deepEqual(tick(chapters, 0, 10_100, none, on), { kind: 'enter', index: 1 });
  assert.deepEqual(tick(chapters, 4, 50_000, none, on), { kind: 'end' });
});

test('자동 재생을 끄면 다음 챕터 시작점에서 멈춘다', () => {
  assert.deepEqual(tick(chapters, 1, 20_200, none, { autoNext: false, skipRead: false }), { kind: 'hold', index: 2, atMs: 20_000 });
});

test('읽은 항목 건너뛰기: 읽은 챕터에 들어서면 다음 안 읽은 챕터로 seek', () => {
  const read = new Set([102, 103]);
  const prefs = { autoNext: true, skipRead: true };
  assert.equal(startIndex(chapters, read, true), 0);
  assert.deepEqual(tick(chapters, 0, 10_100, read, prefs), { kind: 'skip', index: 3, toMs: 30_000 });
  assert.equal(startIndex(chapters, new Set([101]), true), 1);
  // 남은 게 전부 읽은 항목이면 끝
  assert.deepEqual(tick(chapters, 2, 30_100, new Set([104, 105]), prefs), { kind: 'end' });
  // 다 읽었으면 처음부터
  assert.equal(startIndex(chapters, new Set([101, 102, 103, 104, 105]), true), 0);
});

test('뒤로 이동하면 그 챕터에 들어선다', () => {
  assert.deepEqual(tick(chapters, 3, 12_000, none, on), { kind: 'enter', index: 1 });
  assert.deepEqual(tick(chapters, -1, 0, none, on), { kind: 'enter', index: 0 });
});

test('진행률은 건너뛴 챕터를 빼고 센다', () => {
  const read = new Set([101]);
  const p = progress(chapters, 2, 25_000, read, true);
  assert.equal(p.count, 4);
  assert.equal(p.totalMs, 40_000);
  assert.equal(p.position, 2);
  assert.equal(p.elapsedMs, 15_000);
  assert.deepEqual(p.segments.map((s) => s.fill), [0, 1, 0.5, 0, 0]);
  assert.equal(nextPlayable(chapters, 0, read, true), 1);
});

test('대본 줄 위치: 줄 사이 쉼에서는 직전 줄을 유지', () => {
  assert.equal(lineAt(chapters[0], 100), -1);
  assert.equal(lineAt(chapters[0], 4_200), 0);
  assert.equal(lineAt(chapters[0], 4_600), 1);
});
