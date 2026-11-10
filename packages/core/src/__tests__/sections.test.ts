import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankFeed, todaysTopics, topicShares } from '../feed/rankFeed';
import { briefingSlot, sectionOf, sectionOfTopic, SECTION_IDS, withSectionTopics } from '../sections';
import { NEWS_SECTIONS } from '../topics/dictionary';

test('분야는 8개이고 사전의 뉴스 분야와 같다', () => {
  assert.equal(SECTION_IDS.length, 8);
  assert.deepEqual([...SECTION_IDS].sort(), NEWS_SECTIONS.map((t) => t.id).sort());
});

test('소식의 분야: 뉴스 분야 토픽 → 관심 분야 → 요약 카테고리 순', () => {
  assert.equal(sectionOf({ topicIds: ['ai', 'sports'], category: 'ai' }), 'sports');
  assert.equal(sectionOf({ topicIds: ['llm-dev', 'ai'], category: 'business' }), 'it-science');
  assert.equal(sectionOf({ topicIds: ['stock'] }), 'economy');
  assert.equal(sectionOf({ category: 'beauty' }), 'life-culture');
  assert.equal(sectionOf({ category: 'entertainment' }), 'entertainment');
  assert.equal(sectionOf({ category: 'etc' }), null);
  assert.equal(sectionOf({}), null);
});

test('분야로 고르면 AI·주식 소식도 IT/과학·경제로 친다', () => {
  assert.equal(sectionOfTopic('llm-dev'), 'it-science');
  assert.equal(sectionOfTopic('kospi'), 'economy');
  assert.equal(sectionOfTopic('sports'), 'sports');
  assert.equal(sectionOfTopic('nope'), null);
  const t = withSectionTopics([{ topicId: 'llm-dev', relevance: 0.8 }, { topicId: 'ai', relevance: 0.9 }, { topicId: 'world', relevance: 1 }]);
  assert.equal(t.find((x) => x.topicId === 'it-science')?.relevance, 0.9);
  assert.equal(t.find((x) => x.topicId === 'world')?.relevance, 1);
  const c = (id: number, topicId: string) => ({ id, ageHours: 1, sourceWeight: 1, size: 1, isVideo: false, topics: [{ topicId, relevance: 0.9 }] });
  const got = rankFeed([c(1, 'llm-dev'), c(2, 'kospi'), c(3, 'politics')], { 'it-science': 1, economy: 1 }, new Set(), { limit: 5 });
  assert.deepEqual(got.map((r) => [r.clusterId, r.topicId]).sort(), [[1, 'it-science'], [2, 'economy']]);
});

test('비중이 다르면 큰 분야부터 자리와 몫을 준다(같으면 예전대로)', () => {
  const w = { economy: 1.2, 'it-science': 1, politics: 0.3, society: 0.3, world: 0.3, sports: 0.3, entertainment: 0.3, 'life-culture': 0.3 };
  const today = todaysTopics(w, 5, '2026-11-10')!;
  assert.deepEqual(today.slice(0, 2), ['economy', 'it-science']);
  assert.equal(today.length, 5);
  const share = topicShares(5, w);
  assert.equal(share('economy'), 2);
  assert.equal(share('politics'), 1);
  assert.equal(topicShares(5, { ai: 1, stock: 1 })('ai'), 3);
});

test('오전이면 출근길, 오후면 퇴근길(한국 시각)', () => {
  assert.equal(briefingSlot(new Date('2026-11-10T22:30:00Z')), 'am'); // 11일 07:30 KST
  assert.equal(briefingSlot(new Date('2026-11-11T02:59:00Z')), 'am'); // 11:59 KST
  assert.equal(briefingSlot(new Date('2026-11-11T03:00:00Z')), 'pm'); // 12:00 KST
  assert.equal(briefingSlot(new Date('2026-11-11T09:00:00Z')), 'pm'); // 18:00 KST
});
