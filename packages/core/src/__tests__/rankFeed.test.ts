import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedbackDelta, linkCap, rankFeed, type RankCandidate } from '../feed/rankFeed';
import { initialTopicWeights, TOPIC_GROUPS, TOPICS, whyLead } from '../topics/dictionary';

const c = (id: number, topicId: string, extra: Partial<RankCandidate> = {}): RankCandidate => ({
  id,
  ageHours: 6,
  sourceWeight: 1,
  size: 1,
  isVideo: false,
  topics: [{ topicId, relevance: 0.9 }],
  ...extra,
});

test('같은 토픽은 최대 2개까지만 고른다', () => {
  const candidates = [c(1, 'rag'), c(2, 'rag'), c(3, 'rag'), c(4, 'llm-agent'), c(5, 'database')];
  const out = rankFeed(candidates, { rag: 1, 'llm-agent': 0.5, database: 0.3 }, new Set(), { limit: 4 });
  assert.equal(out.filter((x) => x.topicId === 'rag').length, 2);
  assert.deepEqual(out.map((x) => x.clusterId).sort(), [1, 2, 4, 5]);
});

test('영상은 최대 2개까지만 고른다', () => {
  const candidates = [1, 2, 3].map((id) => c(id, `t${id}`, { isVideo: true })).concat([c(4, 't4'), c(5, 't5')]);
  const weights = { t1: 1, t2: 1, t3: 1, t4: 0.2, t5: 0.2 };
  const out = rankFeed(candidates, weights, new Set());
  assert.equal(out.length, 5);
  // 제약을 지키며 4개를 고른 뒤, 모자란 1칸은 제약을 풀어 채운다
  const firstFour = rankFeed(candidates, weights, new Set(), { limit: 4 });
  assert.equal(firstFour.filter((x) => candidates.find((k) => k.id === x.clusterId)!.isVideo).length, 2);
});

test('관심사가 하나뿐이어도 영상 상한은 토픽당 개수를 푼 뒤 맨 나중에 푼다', () => {
  // 인기 높은 영상 10개 + 글 8개가 모두 한 토픽. 토픽당 2개를 풀어 채울 때도 영상은 2개까지만(배송은 영상을 요약하지 않는다)
  const videos = Array.from({ length: 10 }, (_, i) => c(i + 1, 'ai', { isVideo: true, popularity: 5 }));
  const articles = Array.from({ length: 8 }, (_, i) => c(i + 11, 'ai'));
  const out = rankFeed([...videos, ...articles], { ai: 1 }, new Set(), { limit: 8 });
  assert.equal(out.length, 8);
  assert.equal(out.filter((x) => x.clusterId <= 10).length, 2);
  // 글이 모자라면 그제야 영상으로 채운다
  const few = rankFeed([...videos, ...articles.slice(0, 3)], { ai: 1 }, new Set(), { limit: 8 });
  assert.equal(few.length, 8);
  assert.equal(few.filter((x) => x.clusterId <= 10).length, 5);
});

test('내 관심 링크 글은 상한(maxLinks)까지만 고르고, 한 링크는 토픽당 2개 규칙을 따른다', () => {
  // 링크 글은 관련도 1이라 점수가 높다. 상한 2면 2개까지, 남은 자리는 관심사 소식으로
  const link = (id: number, topicId: string) => c(id, topicId, { topics: [{ topicId, relevance: 1 }] });
  const candidates = [link(1, 's-1'), link(2, 's-1'), link(3, 's-1'), link(4, 's-2'), c(5, 'rag'), c(6, 'security')];
  const weights = { 's-1': 1, 's-2': 1, rag: 0.6, security: 0.6 };
  const out = rankFeed(candidates, weights, new Set(), { limit: 4, maxLinks: 2 });
  assert.equal(out.filter((x) => x.topicId.startsWith('s-')).length, 2);
  assert.deepEqual(out.map((x) => x.clusterId).sort(), [1, 2, 5, 6]);
  // 상한 없이: 링크 s-1은 토픽당 2개까지, s-2 1개, 나머지 1칸은 관심사
  const free = rankFeed(candidates, weights, new Set(), { limit: 4 });
  assert.deepEqual(free.map((x) => x.clusterId).sort(), [1, 2, 4, 5]);
  // 관심사 소식이 모자라면 제약을 풀어 링크 글로 채운다
  const fill = rankFeed(candidates.slice(0, 4), weights, new Set(), { limit: 3, maxLinks: 1 });
  assert.equal(fill.length, 3);
  assert.equal(linkCap(10), 5);
  assert.equal(linkCap(3), 2);
});

test('제외 목록과 관련 없는 토픽은 빼고, 대표 토픽은 기여가 가장 큰 토픽이다', () => {
  const multi = c(1, 'rag', { topics: [{ topicId: 'rag', relevance: 0.4 }, { topicId: 'llm-agent', relevance: 0.9 }] });
  const out = rankFeed([multi, c(2, 'rag'), c(3, 'security')], { rag: 1, 'llm-agent': 1 }, new Set([2]));
  assert.deepEqual(out.map((x) => x.clusterId), [1]);
  assert.equal(out[0]!.topicId, 'llm-agent');
});

test('상세 관심사만 골랐으면 큰 분류나 다른 상세 관심사만 붙은 소식은 고르지 않는다(모자라도 채우지 않는다)', () => {
  // 코스피·코스닥만 고른 사람: 주식(큰 분류)·미국 주식만 붙은 소식은 빼고, 코스피가 붙은 것만(2026-10-22 버그)
  const kospi = c(1, 'kospi', { topics: [{ topicId: 'kospi', relevance: 1 }, { topicId: 'stock', relevance: 1 }] });
  const stockOnly = c(2, 'stock', { topics: [{ topicId: 'stock', relevance: 1 }] });
  const us = c(3, 'stock-us', { topics: [{ topicId: 'stock-us', relevance: 1 }, { topicId: 'stock', relevance: 1 }] });
  const out = rankFeed([kospi, stockOnly, us], { kospi: 1, kosdaq: 1 }, new Set(), { limit: 10 });
  assert.deepEqual(out.map((x) => [x.clusterId, x.topicId]), [[1, 'kospi']]);
});

test('신선한 소식과 여러 곳에서 다룬 소식이 위로 간다', () => {
  const out = rankFeed([c(1, 'rag', { ageHours: 60 }), c(2, 'rag', { ageHours: 2 }), c(3, 'rag', { ageHours: 60, size: 6 })], { rag: 1 }, new Set(), { maxPerTopic: 5 });
  assert.deepEqual(out.map((x) => x.clusterId), [2, 3, 1]);
});

test('피드백 가중치는 0.1~1.5 사이에 머문다', () => {
  assert.equal(Number((1 + feedbackDelta('more', 1)).toFixed(2)), 1.1);
  assert.equal(1.45 + feedbackDelta('more', 1.45), 1.5);
  assert.equal(Number((0.2 + feedbackDelta('skip', 0.2)).toFixed(2)), 0.1);
  assert.equal(feedbackDelta('known', 1), 0);
});

test('처음 토픽: 고른 것만 1.0, 사전에 없는 id는 버린다', () => {
  assert.deepEqual(initialTopicWeights(['rag', 'bitcoin', 'nope']), { rag: 1, bitcoin: 1 });
});

test('사전 id는 겹치지 않고, 큰 분류는 부모가 없다', () => {
  assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length);
  assert.ok(TOPIC_GROUPS.every((t) => !t.parent));
});

test('why 앞머리는 직업이 아니라 관심 토픽으로', () => {
  assert.equal(whyLead('RAG'), 'RAG에 관심 있다면');
});
