import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDummyAi } from '../ai/dummy';
import { childrenOf, TOPIC_GROUPS, TOPICS, withParents } from '../topics/dictionary';
import { customTopicId, findTopicByName, isAdultInterest, isCustomTopicId, splitInterests } from '../topics/interests';
import { matchTopics } from '../topics/match';
import { josa } from '../util/josa';

const m = (text: string) => matchTopics(text, TOPICS);

test('문장에서 토픽 찾기: 이름·별칭, 조사가 붙은 낱말', () => {
  assert.deepEqual(m('쿠버네티스랑 보안').sort(), ['kubernetes', 'security']);
  // 상세 관심사가 맞으면 큰 분류(프론트엔드)는 빼고 상세 관심사만
  assert.deepEqual(m('프론트엔드 성능'), ['web-perf']);
  assert.deepEqual(m('미국 주식이랑 청약').sort(), ['re-subscription', 'stock-us']);
  assert.deepEqual(m('부동산'), ['realestate']);
  assert.deepEqual(m('스프링 부트랑 코틀린').sort(), ['kotlin', 'spring']);
  assert.deepEqual(m('파인튜닝'), ['fine-tuning']);
  assert.deepEqual(m('AWS랑 GCP').sort(), ['aws', 'gcp']);
  assert.deepEqual(m('RAG'), ['rag']);
  assert.ok(m('요즘 LLM 에이전트 만들어요').includes('llm-agent'));
  assert.deepEqual(m('요리'), []);
});

test('최대 3개까지만 돌려준다', () => {
  assert.equal(m('RAG, 쿠버네티스, 보안, 디자인 시스템, 그로스').length, 3);
});

test('더미 AI도 사전 안의 id만 돌려준다', async () => {
  const ai = createDummyAi();
  const ids = await ai.mapTopics({ model: 'm', text: '모바일 앱 성능', dictionary: TOPICS });
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

test('큰 분류 5개와 상세 관심사', () => {
  assert.deepEqual(TOPIC_GROUPS.map((t) => t.name), ['AI', '백엔드', '프론트엔드', '부동산', '주식']);
  for (const g of TOPIC_GROUPS) assert.ok(childrenOf(g.id).length >= 4, g.id);
  // 상세 관심사의 부모는 모두 큰 분류
  const groups = new Set(TOPIC_GROUPS.map((t) => t.id));
  assert.ok(TOPICS.filter((t) => t.parent).every((t) => groups.has(t.parent!)));
});

test('상세 관심사 태그에 큰 분류를 더한다(관련도는 자식 중 가장 큰 값)', () => {
  assert.deepEqual(withParents([{ topicId: 'postgres', relevance: 0.9 }, { topicId: 'database', relevance: 0.6 }]), [
    { topicId: 'postgres', relevance: 0.9 },
    { topicId: 'backend', relevance: 0.9 },
    { topicId: 'database', relevance: 0.6 },
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
  assert.equal(findTopicByName('청약')?.id, 're-subscription');
  assert.equal(findTopicByName('aws')?.id, 'aws');
  assert.equal(findTopicByName('스프링 부트')?.id, 'spring');
  assert.equal(findTopicByName('드론'), null);
});

test('직접 입력: 새 관심사 id는 같은 말이면 같다', () => {
  assert.equal(customTopicId('드론'), customTopicId(' 드 론 '));
  assert.notEqual(customTopicId('드론'), customTopicId('전기차'));
  assert.ok(isCustomTopicId(customTopicId('드론')));
  assert.ok(!isCustomTopicId('backend'));
});

test('직접 입력: 성인 키워드는 막는다(띄어쓰기·대소문자 섞어도)', () => {
  for (const t of ['야동', '19금 웹툰', 'P o r n', '성인 용품', 'NSFW 그림', '조건 만남']) assert.ok(isAdultInterest(t), t);
  for (const t of ['Sexy 화보', 'xxx 영상']) assert.ok(isAdultInterest(t), t);
  for (const t of ['성인 ADHD', '드론', '미국 주식', 'Sussex 대학', 'Essex 축구']) assert.ok(!isAdultInterest(t), t);
});
