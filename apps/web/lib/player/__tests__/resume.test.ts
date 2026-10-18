import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Chapter } from '@maengo/core/types';
import { parseResume, resumeTarget } from '../resume';
import { initialRate, isRate, nextRate } from '../rate';

// 10초짜리 챕터 3개. clusterId = 101~103
const chapters: Chapter[] = [0, 1, 2].map((i) => ({
  rank: i + 1,
  clusterId: 101 + i,
  title: `t${i + 1}`,
  startMs: i * 10_000,
  endMs: (i + 1) * 10_000,
  lines: [],
}));
const none = new Set<number>();
const saved = (clusterId: number, offsetMs: number, date = '2026-10-18') => JSON.stringify({ date, mode: 'today', clusterId, offsetMs });

test('이어 듣기 값 읽기: 같은 날 오늘 듣기만', () => {
  assert.deepEqual(parseResume(saved(102, 4_200), '2026-10-18'), { date: '2026-10-18', mode: 'today', clusterId: 102, offsetMs: 4_200 });
  assert.equal(parseResume(saved(102, 4_200, '2026-10-17'), '2026-10-18'), null);
  assert.equal(parseResume(null, '2026-10-18'), null);
  assert.equal(parseResume('{', '2026-10-18'), null);
  assert.equal(parseResume('null', '2026-10-18'), null);
  assert.equal(parseResume(JSON.stringify({ date: '2026-10-18', mode: 'playlist', clusterId: 1, offsetMs: 0 }), '2026-10-18'), null);
  assert.equal(parseResume(JSON.stringify({ date: '2026-10-18', mode: 'today', clusterId: 1.5, offsetMs: 0 }), '2026-10-18'), null);
  // 음수 자리는 0으로
  assert.equal(parseResume(saved(101, -30), '2026-10-18')?.offsetMs, 0);
});

test('이어 들을 자리: 듣던 소식의 듣던 자리, 거의 다 들었으면 다음 소식 처음', () => {
  const r = (clusterId: number, offsetMs: number) => parseResume(saved(clusterId, offsetMs), '2026-10-18');
  assert.deepEqual(resumeTarget(chapters, r(102, 4_200), none, false), { index: 1, offsetMs: 4_200 });
  assert.deepEqual(resumeTarget(chapters, r(102, 9_000), none, false), { index: 2, offsetMs: 0 });
  // 다음 소식을 읽어서 건너뛰면 그다음이 없으니 처음 자리부터(null)
  assert.equal(resumeTarget(chapters, r(102, 9_000), new Set([103]), true), null);
  // 듣던 소식은 읽었어도 이어 듣는다
  assert.deepEqual(resumeTarget(chapters, r(101, 3_000), new Set([101]), true), { index: 0, offsetMs: 3_000 });
  // 목록에 없는 소식이면 처음 자리부터
  assert.equal(resumeTarget(chapters, r(999, 3_000), none, false), null);
  assert.equal(resumeTarget(chapters, null, none, false), null);
});

test('재생 속도는 정해진 값만 돌고, 이상한 값은 1배', () => {
  assert.equal(nextRate(1), 1.2);
  assert.equal(nextRate(0.8), 1);
  assert.equal(nextRate(3), 1);
  assert.equal(isRate(1.5), true);
  assert.equal(isRate(2), false);
  assert.equal(initialRate(1.2), 1.2);
  assert.equal(initialRate(undefined), 1);
  assert.equal(initialRate('1.5'), 1);
});
