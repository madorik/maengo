import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MODELS, modelFor, modelForPlan, tierOf } from '../ai/models';
import { createDummyAi, dummyScript } from '../ai/dummy';
import { layoutChapters } from '../audio/chapters';
import { concatWav } from '../audio/wav';

test('무료는 Flash, 플러스와 체험은 상위 모델', () => {
  assert.equal(tierOf('free'), 'basic');
  assert.equal(tierOf('trial'), 'pro');
  assert.equal(modelForPlan('free', {}), DEFAULT_MODELS.basic);
  assert.equal(modelForPlan('plus', {}), DEFAULT_MODELS.pro);
  assert.equal(modelFor('pro', { GEMINI_MODEL_PLUS: ' gemini-x-pro ' }), 'gemini-x-pro');
  assert.equal(modelFor('basic', { GEMINI_MODEL_FREE: '' }), DEFAULT_MODELS.basic);
});

const item = {
  model: 'm',
  rank: 3,
  topicName: 'LLM 에이전트',
  title: '에이전트 평가, 정답셋 없이 시작하는 법',
  short: '실패한 대화를 모아 평가셋의 씨앗으로 씁니다.',
  body: ['실패한 대화를 모읍니다. 사람이 고친 답이 곧 정답이에요.', '처음부터 완벽한 정답셋을 만들 필요는 없어요.'],
  why: '백엔드 개발자라면: RAG 챗봇 회귀 테스트에 바로 쓸 수 있어요.',
};

test('더미 대본: 대담은 진행자·해설자가 번갈아 말하고, 해설자가 문단을 읽는다', () => {
  const lines = dummyScript({ ...item, persona: 'dialogue' });
  assert.deepEqual(lines.map((l) => l.who), ['진행자', '해설자', '진행자', '해설자', '진행자', '해설자']);
  assert.deepEqual(lines.map((l) => l.para), [undefined, 0, undefined, 1, undefined, undefined]);
  assert.match(lines[0]!.text, /세 번째/);
  assert.match(lines.at(-1)!.text, /백엔드 개발자라면, /);
});

test('더미 대본: 본문을 문장 단위로 읽고 문단 번호를 단다', () => {
  const lines = dummyScript({ ...item, persona: 'announcer' });
  assert.deepEqual(lines.filter((l) => l.para !== undefined).map((l) => [l.para, l.text]), [
    [0, '실패한 대화를 모읍니다.'],
    [0, '사람이 고친 답이 곧 정답이에요.'],
    [1, '처음부터 완벽한 정답셋을 만들 필요는 없어요.'],
  ]);
});

test('더미 음성: 줄 시각이 겹치지 않고 길이와 PCM 크기가 맞는다', async () => {
  const ai = createDummyAi();
  const lines = await ai.script({ ...item, persona: 'teacher' });
  const out = await ai.speak({ model: 'm', persona: 'teacher', voice: 'f', lines });
  assert.equal(out.lineTimesMs.length, lines.length);
  for (let i = 1; i < out.lineTimesMs.length; i++) {
    assert.ok(out.lineTimesMs[i]!.startMs >= out.lineTimesMs[i - 1]!.endMs);
  }
  assert.equal(out.pcm.length, Math.ceil((out.durationMs / 1000) * out.sampleRate));
});

test('더미 why: 미리 만든 본문이 있으면 그것을, 없으면 기본 문장을 쓴다', async () => {
  const ai = createDummyAi({ whyBody: (id) => (id === 1 ? '바로 써 보세요.' : undefined) });
  const base = { model: 'm', title: '', short: '', body: [], topicId: 'rag', topicName: 'RAG', jobLead: 'PM이라면' };
  assert.equal(await ai.why({ ...base, clusterId: 1 }), 'PM이라면: 바로 써 보세요.');
  assert.match(await ai.why({ ...base, clusterId: 2 }), /^PM이라면: RAG/);
});

test('챕터는 세그먼트를 이어 붙인 위치를 가리킨다', () => {
  const chapters = layoutChapters([
    { rank: 1, clusterId: 10, title: 'a', durationMs: 1000, lines: [{ text: 'x', startMs: 100, endMs: 600 }] },
    { rank: 2, clusterId: 11, title: 'b', durationMs: 2000, lines: [{ text: 'y', startMs: 0, endMs: 900 }] },
  ]);
  assert.deepEqual(chapters.map((c) => [c.startMs, c.endMs]), [[0, 1000], [1000, 3000]]);
  assert.deepEqual(chapters[1]!.lines[0], { text: 'y', startMs: 1000, endMs: 1900 });
});

test('WAV를 이어 붙이면 헤더의 데이터 크기가 조각 합과 같다', () => {
  const wav = concatWav([new Uint8Array(10), new Uint8Array(6)], 8000, 8);
  assert.equal(wav.length, 44 + 16);
  assert.equal(new DataView(wav.buffer).getUint32(40, true), 16);
});
