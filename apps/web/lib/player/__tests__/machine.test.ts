import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Chapter } from '@maengo/core/types';
import { chapterAt, heldOffset, lineAt, nextPlayable, positionAt, progress, startIndex, tick, withRealChapter } from '../machine';

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

test('진행 막대 자리 → 챕터와 시각(건너뛴 챕터는 빼고 센다)', () => {
  assert.deepEqual(positionAt(chapters, 0, none, false), { index: 0, ms: 0 });
  assert.deepEqual(positionAt(chapters, 25_000, none, false), { index: 2, ms: 25_000 });
  // 101을 읽어 건너뛰면 막대의 0초는 102의 처음, 15초는 103의 5초
  const read = new Set([101]);
  assert.deepEqual(positionAt(chapters, 0, read, true), { index: 1, ms: 10_000 });
  assert.deepEqual(positionAt(chapters, 15_000, read, true), { index: 2, ms: 25_000 });
  // 끝까지 끌면 마지막 항목 끝 조금 앞
  assert.deepEqual(positionAt(chapters, 99_000, none, false), { index: 4, ms: 49_500 });
  assert.equal(positionAt([], 1_000, none, false), null);
});

test('첫 소식 먼저 듣기: 어림값 챕터를 실제 시각표로 바꿔 끼운다', () => {
  // 소식 하나짜리 파일의 실제 시각표(0부터, 12초)
  const real: Chapter = {
    rank: 2,
    clusterId: 102,
    title: 't2',
    startMs: 0,
    endMs: 12_000,
    lines: [{ text: 'a', startMs: 300, endMs: 5_000 }, { text: 'b', startMs: 5_500, endMs: 11_800 }],
  };
  const fixed = withRealChapter(chapters, 1, real);
  assert.equal(fixed[1]!.startMs, 10_000);
  assert.equal(fixed[1]!.endMs, 22_000);
  assert.deepEqual(fixed[1]!.lines.map((l) => l.startMs), [10_300, 15_500]);
  assert.equal(fixed[0], chapters[0]);
  assert.equal(fixed[2], chapters[2]);
  assert.equal(lineAt(fixed[1], 16_000), 1);
  // 다른 소식의 시각표면 그대로
  assert.equal(withRealChapter(chapters, 0, real), chapters);
});

test('heldOffset: 파일이 열려 있으면 실제 재생 위치로', () => {
  assert.equal(heldOffset(chapters, 1, { pending: null, fileMs: 13_500, posMs: 11_000 }), 3_500);
});

test('heldOffset: 파일을 떼어 냈으면(취소·오류 뒤) 화면의 자리로', () => {
  // 떼어 낸 <audio>의 currentTime은 0이라 그대로 쓰면 듣던 자리를 잃는다
  assert.equal(heldOffset(chapters, 1, { pending: null, fileMs: null, posMs: 17_200 }), 7_200);
});

test('heldOffset: 옮겨 갈 자리를 기다리는 중이면 그 자리로', () => {
  assert.equal(heldOffset(chapters, 2, { pending: { index: 2, offsetMs: 4_000 }, fileMs: 0, posMs: 20_000 }), 4_000);
  assert.equal(heldOffset(chapters, 2, { pending: { index: 2 }, fileMs: 0, posMs: 25_000 }), 0);
  assert.equal(heldOffset(chapters, 2, { pending: { index: 3, offsetMs: 4_000 }, fileMs: 0, posMs: 25_000 }), 0);
});

test('heldOffset: 고른 소식이 없거나 소식 앞 자리면 0', () => {
  assert.equal(heldOffset(chapters, -1, { pending: null, fileMs: 5_000, posMs: 5_000 }), 0);
  assert.equal(heldOffset(chapters, 2, { pending: null, fileMs: 19_000, posMs: 19_000 }), 0);
});
