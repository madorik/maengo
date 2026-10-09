import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedbackDelta, rankFeed, type RankCandidate } from '../feed/rankFeed';
import { initialTopicWeights, JOB_PRIOR_WEIGHT } from '../topics/dictionary';

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

test('제외 목록과 관련 없는 토픽은 빼고, 대표 토픽은 기여가 가장 큰 토픽이다', () => {
  const multi = c(1, 'rag', { topics: [{ topicId: 'rag', relevance: 0.4 }, { topicId: 'llm-agent', relevance: 0.9 }] });
  const out = rankFeed([multi, c(2, 'rag'), c(3, 'security')], { rag: 1, 'llm-agent': 1 }, new Set([2]));
  assert.deepEqual(out.map((x) => x.clusterId), [1]);
  assert.equal(out[0]!.topicId, 'llm-agent');
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

test('콜드 스타트: 고른 토픽은 1.0, 직업 추천 중 안 고른 토픽은 0.3', () => {
  const w = initialTopicWeights('backend', ['rag', 'react', 'nope']);
  assert.equal(w.rag, 1);
  assert.equal(w.react, 1);
  assert.equal(w['llm-agent'], JOB_PRIOR_WEIGHT);
  assert.equal(w.nope, undefined);
});
