import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDummyAi } from '../ai/dummy';
import { childrenOf, TOPIC_GROUPS, TOPICS, withParents } from '../topics/dictionary';
import { customTopicId, findTopicByName, isAdultInterest, isCustomTopicId, splitInterests } from '../topics/interests';
import { matchTopics } from '../topics/match';
import { josa } from '../util/josa';

const m = (text: string) => matchTopics(text, TOPICS);

test('문장에서 토픽 찾기: 이름·별칭, 조사가 붙은 낱말', () => {
  assert.deepEqual(m('쿠버네티스랑 보안').sort(), ['cloud', 'security']);
  // 상세 관심사가 맞으면 큰 분류(개발)는 빼고 상세 관심사만
  assert.deepEqual(m('개발 보안'), ['security']);
  assert.deepEqual(m('미국 주식이랑 스테이블코인').sort(), ['stablecoin', 'stock-us']);
  assert.deepEqual(m('K-Pop'), ['kpop']);
  // 같은 상세 관심사의 별칭 여럿은 하나로
  assert.deepEqual(m('스프링 부트랑 코틀린'), ['dev-release']);
  assert.deepEqual(m('바이브 코딩'), ['vibe-coding']);
  assert.deepEqual(m('AWS랑 GCP'), ['cloud']);
  assert.deepEqual(m('RAG'), ['rag']);
  // 뺀 분야(부동산)는 맞는 토픽이 없다
  assert.deepEqual(m('부동산'), []);
  assert.ok(m('요즘 LLM 에이전트 만들어요').includes('llm-agent'));
  assert.deepEqual(m('요리'), []);
});

test('최대 3개까지만 돌려준다', () => {
  assert.equal(m('RAG, 쿠버네티스, 보안, 비트코인, 반도체').length, 3);
});

test('더미 AI도 사전 안의 id만 돌려준다', async () => {
  const ai = createDummyAi();
  const ids = await ai.mapTopics({ model: 'm', text: '휴머노이드 로봇', dictionary: TOPICS });
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => TOPICS.some((t) => t.id === id)));
});

test('조사: 한글 받침, 영문·숫자는 읽는 소리로', () => {
  assert.equal(josa('보안', '을', '를'), '보안을');
  assert.equal(josa('쿠버네티스', '을', '를'), '쿠버네티스를');
  assert.equal(josa('PostgreSQL', '은', '는'), 'PostgreSQL은');
  assert.equal(josa('React', '은', '는'), 'React는');
  assert.equal(josa('RAG', '을', '를'), 'RAG를');
  assert.equal(josa('k8s', '을', '를'), 'k8s를');
});

test('큰 분류 8개와 상세 관심사', () => {
  assert.deepEqual(TOPIC_GROUPS.map((t) => t.name), ['AI', '주식', '코인', '반도체·로봇', '개발', 'K-Pop', 'K-뷰티', 'K-푸드']);
  for (const g of TOPIC_GROUPS) assert.ok(childrenOf(g.id).length >= 3, g.id);
  // 직접 적은 말을 이름으로 사전에 잇기 때문에 이름은 겹치지 않는다
  assert.equal(new Set(TOPICS.map((t) => t.name)).size, TOPICS.length);
  // 상세 관심사의 부모는 모두 큰 분류
  const groups = new Set(TOPIC_GROUPS.map((t) => t.id));
  assert.ok(TOPICS.filter((t) => t.parent).every((t) => groups.has(t.parent!)));
});

test('상세 관심사 태그에 큰 분류를 더한다(관련도는 자식 중 가장 큰 값)', () => {
  assert.deepEqual(withParents([{ topicId: 'dev-release', relevance: 0.9 }, { topicId: 'security', relevance: 0.6 }]), [
    { topicId: 'dev-release', relevance: 0.9 },
    { topicId: 'dev', relevance: 0.9 },
    { topicId: 'security', relevance: 0.6 },
  ]);
  assert.deepEqual(withParents([{ topicId: 'stock', relevance: 0.7 }]), [{ topicId: 'stock', relevance: 0.7 }]);
});

test('직접 입력: 나누기·중복 빼기·최대 3개', () => {
  assert.deepEqual(splitInterests('드론, 전기차'), ['드론', '전기차']);
  assert.deepEqual(splitInterests('미국 주식이랑 청약'), ['미국 주식', '청약']);
  assert.deepEqual(splitInterests('Rust 그리고 Go'), ['Rust', 'Go']);
  assert.deepEqual(splitInterests('a, b, c, d'), ['a', 'b', 'c']);
  assert.deepEqual(splitInterests('드론, 드 론'), ['드론']);
});

test('직접 입력: 사전에 같은 이름이 있으면 그 관심사로', () => {
  assert.equal(findTopicByName('스테이블 코인')?.id, 'stablecoin');
  assert.equal(findTopicByName('aws')?.id, 'cloud');
  assert.equal(findTopicByName('스프링 부트')?.id, 'dev-release');
  // 합친 분야(백엔드)는 개발로
  assert.equal(findTopicByName('백엔드')?.id, 'dev');
  // 뺀 분야(부동산·청약)는 이제 직접 적은 관심사가 된다
  assert.equal(findTopicByName('청약'), null);
  assert.equal(findTopicByName('드론'), null);
});

test('직접 입력: 새 관심사 id는 같은 말이면 같다', () => {
  assert.equal(customTopicId('드론'), customTopicId(' 드 론 '));
  assert.notEqual(customTopicId('드론'), customTopicId('전기차'));
  assert.ok(isCustomTopicId(customTopicId('드론')));
  assert.ok(!isCustomTopicId('dev'));
});

test('직접 입력: 성인 키워드는 막는다(띄어쓰기·대소문자 섞어도)', () => {
  for (const t of ['야동', '19금 웹툰', 'P o r n', '성인 용품', 'NSFW 그림', '조건 만남']) assert.ok(isAdultInterest(t), t);
  for (const t of ['Sexy 화보', 'xxx 영상', 's.e.x', 'S E X', 's-e-x 영상']) assert.ok(isAdultInterest(t), t);
  for (const t of ['성인 ADHD', '드론', '미국 주식', 'Sussex 대학', 'Essex 축구']) assert.ok(!isAdultInterest(t), t);
});
