import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMarketQuote } from '../feed/market';
import { bestTopic, feedbackDelta, linkCap, MIN_RELEVANCE, perTopicShare, rankFeed, todaysTopics, type RankCandidate } from '../feed/rankFeed';
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

test('관심사 셋을 고른 무료(하루 3개)는 관심사마다 하나씩 받는다', () => {
  // 주식 소식 점수가 더 높아도 한 관심사가 2개를 가져가지 않는다(2026-10-23: 주식·코인·반도체로봇을 고른 사람이 사흘간 반도체로봇 1개)
  const stock = [1, 2, 3].map((id) => c(id, 'stock', { size: 6 }));
  const out = rankFeed([...stock, c(4, 'coin'), c(5, 'chip-robot')], { stock: 1, coin: 1, 'chip-robot': 1 }, new Set(), { limit: 3 });
  assert.deepEqual(out.map((x) => x.topicId).sort(), ['chip-robot', 'coin', 'stock']);
  assert.equal(perTopicShare(3, { stock: 1, coin: 1, 'chip-robot': 1 }), 1);
  assert.equal(perTopicShare(10, { ai: 1, coin: 1, 'chip-robot': 1, kospi: 1, kosdaq: 1 }), 2);
  assert.equal(perTopicShare(3, { ai: 1, 's-12': 1 }), 3); // 내 관심 링크는 관심사 수에 넣지 않는다
});

test('요약 뒤 분류에 이 사람 관심사가 없으면 대표 토픽이 없다', () => {
  assert.equal(bestTopic([{ topicId: 'society', relevance: 1 }], { kospi: 1, kosdaq: 1 }), null);
  assert.equal(bestTopic([{ topicId: 'kospi', relevance: 0.6 }, { topicId: 'ai', relevance: 0.9 }], { kospi: 1, ai: 0.5 }), 'kospi');
});

test('여분까지 골라도 앞에서부터 하루 소식만큼 쓰면 관심사별 몫이 지켜진다', () => {
  // 배송은 하루 3개 + 여분 3개를 고르고 앞에서부터 쓴다. 점수순으로 다시 섞으면 주식 셋이 앞에 왔다
  const stock = [1, 2, 3, 4].map((id) => c(id, 'stock', { size: 6 }));
  const out = rankFeed([...stock, c(5, 'coin'), c(6, 'chip-robot')], { stock: 1, coin: 1, 'chip-robot': 1 }, new Set(), { limit: 6, visible: 3 });
  assert.deepEqual(out.slice(0, 3).map((x) => x.topicId).sort(), ['chip-robot', 'coin', 'stock']);
  assert.equal(out.length, 6);
});

test('시세·증시 마감 기사는 이틀까지만', () => {
  const quote = (id: number, ageHours: number) => c(id, 'kospi', { ageHours, title: '코스피 7.57% 급락…AI 인프라 신용 리스크' });
  const earnings = c(3, 'kospi', { ageHours: 200, title: 'TSMC 3분기 순이익 68.7% 급증' });
  const out = rankFeed([quote(1, 47), quote(2, 49), earnings], { kospi: 1 }, new Set(), { limit: 10 });
  assert.deepEqual(out.map((x) => x.clusterId).sort(), [1, 3]);
  for (const t of ['뉴욕증시, 기술주 반등에 나스닥 1.11% 상승 마감', '국제유가, 중동 긴장 속 장중 최고치 찍고 하락', '원·달러 환율 1,400원 돌파', 'Bitcoin slides below $100,000']) assert.ok(isMarketQuote(t), t);
  for (const t of ['신현송 한은 총재 취임 6개월, 물가 관리 집중', '이태원참사 유가족 협의회 기자회견', '앤트로픽, IPO 앞두고 매출 15배 급증']) assert.ok(!isMarketQuote(t), t);
});

test('관련도 0.4 아래 분류는 없는 셈 친다', () => {
  const noise = c(1, 'kospi', { topics: [{ topicId: 'kospi', relevance: MIN_RELEVANCE - 0.01 }] });
  const ok = c(2, 'kospi', { topics: [{ topicId: 'kospi', relevance: MIN_RELEVANCE }] });
  assert.deepEqual(rankFeed([noise, ok], { kospi: 1 }, new Set(), { limit: 10 }).map((x) => x.clusterId), [2]);
});

test('관심사가 받는 수보다 많으면 날마다 돌아가며 하나씩 빠진다', () => {
  const weights = { dev: 1, ai: 1, stock: 1, 'chip-robot': 1 };
  // 주식 점수가 늘 높아도, 날마다 차례인 관심사 셋이 하나씩 받는다
  const cands = [c(1, 'dev'), c(2, 'ai'), c(3, 'stock', { size: 9 }), c(4, 'stock', { size: 9 }), c(5, 'chip-robot')];
  const skipped = new Set<string>();
  for (const day of ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']) {
    const got = rankFeed(cands, weights, new Set(), { limit: 6, visible: 3, day }).slice(0, 3).map((x) => x.topicId);
    assert.equal(new Set(got).size, 3, `${day}: ${got}`);
    const missing = Object.keys(weights).filter((t) => !got.includes(t));
    assert.equal(missing.length, 1);
    skipped.add(missing[0]!);
  }
  assert.equal(skipped.size, 4); // 나흘 동안 네 관심사가 한 번씩 빠진다
  assert.equal(todaysTopics({ ai: 1, stock: 1 }, 3, '2026-10-24'), null);
});

test('한국어 출처 소식은 같은 조건의 해외 소식보다 앞선다(langBoost)', () => {
  const out = rankFeed([c(1, 'ai', { lang: 'en' }), c(2, 'ai', { lang: 'ko' })], { ai: 1 }, new Set(), { limit: 2, maxPerTopic: 2 });
  assert.deepEqual(out.map((x) => x.clusterId), [2, 1]);
});

test('해외 소식은 출처 가중치가 두 배 넘게 높아야 한국어 소식을 앞선다', () => {
  const close = rankFeed([c(1, 'ai', { lang: 'en', sourceWeight: 1.9 }), c(2, 'ai', { lang: 'ko', sourceWeight: 1 })], { ai: 1 }, new Set(), { limit: 1 });
  assert.equal(close[0]!.clusterId, 2);
  const far = rankFeed([c(1, 'ai', { lang: 'en', sourceWeight: 2.1 }), c(2, 'ai', { lang: 'ko', sourceWeight: 1 })], { ai: 1 }, new Set(), { limit: 1 });
  assert.equal(far[0]!.clusterId, 1);
});

test('관심사에 한국어 소식이 없으면 해외 소식으로 채운다', () => {
  const out = rankFeed([c(1, 'robot', { lang: 'en' }), c(2, 'ai', { lang: 'ko' })], { robot: 1, ai: 1 }, new Set(), { limit: 2 });
  assert.deepEqual(out.map((x) => x.clusterId).sort(), [1, 2]);
});

test('큰 소식은 점수가 낮아도 맨 앞에 온다', () => {
  // 여러 곳에서 다룬 한국어 주식 소식보다, 해외에서 먼저 나온 새 모델 출시가 앞이다
  const stock = c(1, 'stock', { lang: 'ko', size: 9 });
  const model = c(2, 'ai', { lang: 'en', title: 'Anthropic releases Claude Opus 5' });
  const routine = c(3, 'ai', { lang: 'ko' });
  const out = rankFeed([stock, model, routine], { stock: 1, ai: 1 }, new Set(), { limit: 3 });
  assert.equal(out[0]!.clusterId, 2);
  // AI가 요약하며 routine으로 매겼으면 제목이 그래 보여도 앞에 두지 않는다
  const demoted = rankFeed([stock, { ...model, impact: 'routine' }, routine], { stock: 1, ai: 1 }, new Set(), { limit: 3 });
  assert.equal(demoted[0]!.clusterId, 1);
});

test('notable은 routine보다 앞서고, major는 이틀이 지나면 맨 앞 자리 없이 배수만 남는다', () => {
  const out = rankFeed([c(1, 'ai', { impact: 'routine' }), c(2, 'ai', { impact: 'notable' })], { ai: 1 }, new Set(), { limit: 2, maxPerTopic: 2 });
  assert.deepEqual(out.map((x) => x.clusterId), [2, 1]);
  // 사흘 된 major(신선도 0.14 × 3)보다 방금 나온 routine이 앞
  const old = rankFeed([c(1, 'ai', { impact: 'major', ageHours: 72 }), c(2, 'ai', { impact: 'routine', ageHours: 1 })], { ai: 1 }, new Set(), { limit: 2, maxPerTopic: 2 });
  assert.deepEqual(old.map((x) => x.clusterId), [2, 1]);
});

test('큰 소식은 관심사 차례보다 먼저지만 하루 소식의 절반까지, 관심사별 몫 안에서만', () => {
  const weights = { dev: 1, ai: 1, stock: 1, 'chip-robot': 1, coin: 1 };
  // 2026-10-27 차례는 ai가 아닌 날을 고른다
  const day = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'].find((d) => !todaysTopics(weights, 3, d)!.includes('ai'))!;
  const cands = [c(1, 'ai', { impact: 'major' }), c(2, 'ai', { impact: 'major' }), c(3, 'coin', { impact: 'major' }), c(4, 'dev'), c(5, 'stock'), c(6, 'chip-robot'), c(7, 'coin')];
  const got = rankFeed(cands, weights, new Set(), { limit: 6, visible: 3, day }).slice(0, 3);
  // 하루 3개면 큰 소식은 2개까지(ai 몫 1개 + coin 1개), 남은 1개는 오늘 차례 관심사
  assert.deepEqual(got.slice(0, 2).map((x) => x.clusterId), [1, 3]);
  assert.ok(todaysTopics(weights, 3, day)!.includes(got[2]!.topicId), got[2]!.topicId);
  assert.ok(!['ai', 'coin'].includes(got[2]!.topicId));
});
