import assert from 'node:assert/strict';
import { test } from 'node:test';
import { credibilityLabel, itemQuality, popularityBoost } from '../feed/quality';
import { rankFeed, type RankCandidate } from '../feed/rankFeed';

const now = new Date('2026-10-11T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

test('영상은 하루 조회수로 본다: 많이 볼수록 높고 0.8~1.5 사이', () => {
  const at = (views: number, days = 1) => popularityBoost({ sourceWeight: 1, views, publishedAt: daysAgo(days) }, now);
  assert.equal(at(0), 0.8);
  assert.ok(Math.abs(at(1000) - 1.25) < 0.01);
  assert.ok(at(10_000) > at(1000) && at(1000) > at(100));
  assert.equal(at(100_000_000), 1.5);
  // 같은 조회수면 최근 영상이 더 높다(올린 지 얼마 안 됐는데 많이 본 영상)
  assert.ok(at(10_000, 1) > at(10_000, 10));
  // 방금 올라온 영상은 6시간 지난 것으로 쳐서 지나치게 튀지 않는다
  assert.equal(at(500, 0), at(500, 0.25));
});

test('해커 뉴스 점수는 200점이 기준, 최대 1.3', () => {
  const hn = (hnPoints: number) => popularityBoost({ sourceWeight: 1, hnPoints }, now);
  assert.equal(hn(200), 1);
  assert.ok(hn(1000) > 1.1 && hn(1000) < 1.2);
  assert.equal(hn(50_000), 1.3);
});

test('신호가 없는 블로그·기사는 출처 가중치만 본다', () => {
  assert.equal(popularityBoost({ sourceWeight: 1.2 }, now), 1);
  assert.equal(itemQuality({ sourceWeight: 1.2 }, now), 1.2);
  assert.ok(itemQuality({ sourceWeight: 0.8 }, now) < itemQuality({ sourceWeight: 1.1 }, now));
});

test('출처 신뢰도 표시: 가중치 1.0 이상이 높음', () => {
  assert.equal(credibilityLabel(1.2), '높음');
  assert.equal(credibilityLabel(1), '높음');
  assert.equal(credibilityLabel(0.9), '보통');
});

test('같은 조건이면 많이 본 영상이 순위에서 앞선다', () => {
  const c = (id: number, popularity: number): RankCandidate => ({ id, ageHours: 6, sourceWeight: 1, size: 1, isVideo: true, popularity, topics: [{ topicId: 'ai', relevance: 0.9 }] });
  const out = rankFeed([c(1, 0.9), c(2, 1.4)], { ai: 1 }, new Set(), { limit: 2 });
  assert.deepEqual(out.map((x) => x.clusterId), [2, 1]);
});
