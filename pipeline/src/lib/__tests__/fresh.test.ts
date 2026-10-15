import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshEntries, latestOf, LINK_MAX_PER_FETCH, type FeedEntry } from '../feed';

const entry = (url: string, at: string | null, extra: Partial<FeedEntry> = {}): FeedEntry => ({
  url,
  title: url,
  author: null,
  publishedAt: at ? new Date(at) : null,
  excerpt: '',
  videoId: null,
  views: null,
  hnPoints: null,
  isShort: false,
  ...extra,
});

test('창 안의 글만, 최신순. 날짜 없는 글은 앞 3개만, 쇼츠는 뺀다', () => {
  const since = Date.parse('2026-10-13T00:00:00Z');
  const entries = [
    entry('old', '2026-10-01T00:00:00Z'),
    entry('new1', '2026-10-14T00:00:00Z'),
    entry('new2', '2026-10-15T00:00:00Z'),
    entry('short', '2026-10-15T01:00:00Z', { isShort: true }),
    entry('u1', null),
    entry('u2', null),
    entry('u3', null),
    entry('u4', null),
  ];
  assert.deepEqual(freshEntries(entries, since).map((e) => e.url), ['new2', 'new1', 'u1', 'u2', 'u3']);
  // 내 관심 링크 출처는 한 번에 LINK_MAX_PER_FETCH개까지
  const many = Array.from({ length: 30 }, (_, i) => entry(`p${i}`, `2026-10-14T00:${String(i).padStart(2, '0')}:00Z`));
  const capped = freshEntries(many, since, LINK_MAX_PER_FETCH);
  assert.equal(capped.length, LINK_MAX_PER_FETCH);
  assert.equal(capped[0]!.url, 'p29');
  assert.equal(capped.at(-1)!.url, 'p10');
});

test('마지막 글 시각은 날짜 중 가장 큰 것, 날짜가 없으면 null', () => {
  assert.equal(latestOf([entry('a', '2026-10-01T00:00:00Z'), entry('b', '2026-10-09T00:00:00Z'), entry('c', null)]), '2026-10-09T00:00:00.000Z');
  assert.equal(latestOf([entry('c', null)]), null);
  assert.equal(latestOf([]), null);
});
