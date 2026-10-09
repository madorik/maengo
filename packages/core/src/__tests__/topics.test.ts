import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDummyAi } from '../ai/dummy';
import { TOPICS } from '../topics/dictionary';
import { matchTopics } from '../topics/match';
import { josa } from '../util/josa';

const m = (text: string) => matchTopics(text, TOPICS);

test('문장에서 토픽 찾기: 이름·별칭, 조사가 붙은 낱말', () => {
  assert.deepEqual(m('쿠버네티스랑 보안').sort(), ['kubernetes', 'security']);
  assert.deepEqual(m('프론트엔드 성능'), ['web-perf', 'react']);
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
