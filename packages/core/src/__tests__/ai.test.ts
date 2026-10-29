import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isKoreanSummary } from '../ai/gemini';
import { GEMINI_MODELS } from '../ai/models';
import { createDummyAi } from '../ai/dummy';
import { closingLine, templateScript } from '../ai/script';
import { layoutChapters } from '../audio/chapters';
import { concatWav, trimSilence, withTrailingSilence } from '../audio/wav';
import { estimateTimeline, SEGMENT_TAIL_MS } from '../audio/personas';

test('Gemini 모델은 고정 버전만(-latest 별칭·Pro 금지)', () => {
  for (const id of Object.values(GEMINI_MODELS)) {
    assert.doesNotMatch(id, /latest/);
    assert.doesNotMatch(id, /-pro/);
  }
});

const item = {
  model: 'm',
  title: '에이전트 평가, 정답셋 없이 시작하는 법',
  short: '실패한 대화를 모아 평가셋의 씨앗으로 씁니다.',
  body: ['실패한 대화를 모읍니다. 사람이 고친 답이 곧 정답이에요.', '처음부터 완벽한 정답셋을 만들 필요는 없어요.'],
};

test('대본: 본문을 문장 단위로 읽고 문단 번호를 단다', () => {
  const lines = templateScript(item);
  assert.deepEqual(lines.filter((l) => l.para !== undefined).map((l) => [l.para, l.text]), [
    [0, '실패한 대화를 모읍니다.'],
    [0, '사람이 고친 답이 곧 정답이에요.'],
    [1, '처음부터 완벽한 정답셋을 만들 필요는 없어요.'],
  ]);
});

test('더미 음성: 줄 시각이 겹치지 않고 길이와 PCM 크기가 맞는다', async () => {
  const ai = createDummyAi();
  const lines = await ai.script(item);
  const out = await ai.speak({ model: 'm', persona: 'announcer', voice: 'f', lines });
  assert.equal(out.lineTimesMs.length, lines.length);
  for (let i = 1; i < out.lineTimesMs.length; i++) {
    assert.ok(out.lineTimesMs[i]!.startMs >= out.lineTimesMs[i - 1]!.endMs);
  }
  assert.equal(out.pcm.length, Math.ceil((out.durationMs / 1000) * out.sampleRate));
});

test('더미 why: 미리 만든 본문이 있으면 그것을, 없으면 기본 문장을 쓴다', async () => {
  const ai = createDummyAi({ whyBody: (id) => (id === 1 ? '바로 써 보세요.' : undefined) });
  const base = { model: 'm', title: '', short: '', body: [], topicId: 'rag', topicName: 'RAG', lead: 'RAG에 관심 있다면' };
  assert.equal(await ai.why({ ...base, clusterId: 1 }), 'RAG에 관심 있다면: 바로 써 보세요.');
  assert.match(await ai.why({ ...base, clusterId: 2 }), /^RAG에 관심 있다면: RAG/);
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

test('TTS 글: 말투 지시문 없이 대본 줄만', async () => {
  const { ttsText } = await import('../ai/gemini');
  const lines = templateScript(item);
  const text = ttsText(lines);
  assert.ok(!/처럼|읽어 주세요/.test(text));
  assert.deepEqual(text.split('\n'), lines.map((l) => l.text));
});

test('요약 언어 검사: 원어 이름이 섞인 한국어는 통과, 영어 요약은 막는다', () => {
  assert.equal(isKoreanSummary('OpenAI, ChatGPT 음성 모델 GPT-Live-1.1 배포 PostgreSQL 19 출시가 11월로 미뤄졌어요.'), true);
  assert.equal(isKoreanSummary('Import AI 477: In which I tell the IMF the Singularity has begun. Jack Clark writes about RSI.'), false);
  assert.equal(isKoreanSummary(''), false);
});

test('듣기 마지막 줄(아나운서): 정리하면, 제목이라는 소식이었습니다', () => {
  assert.equal(templateScript(item).at(-1)!.text, '정리하면, 에이전트 평가, 정답셋 없이 시작하는 법이라는 소식이었습니다.');
  assert.equal(closingLine('앤트로픽 2분기 매출 115억 달러 달성, 오픈AI 추월'), '정리하면, 앤트로픽 2분기 매출 115억 달러 달성, 오픈AI 추월이라는 소식이었습니다.');
  assert.equal(closingLine('Next.js, 의존성 보안 취약점 패치 예고'), '정리하면, Next.js, 의존성 보안 취약점 패치 예고라는 소식이었습니다.');
  assert.equal(closingLine('코스피 3.73% 급락…'), '정리하면, 코스피 3.73% 급락이라는 소식이었습니다.');
});

test('소식 음성 끝 무음 1초: 24kHz 16비트면 48,000바이트가 0으로 붙는다', () => {
  const pcm = new Uint8Array([1, 2, 3, 4]);
  const out = withTrailingSilence(pcm, 24000, 16, SEGMENT_TAIL_MS);
  assert.equal(out.length, 4 + 24000 * 2);
  assert.deepEqual([...out.subarray(0, 4)], [1, 2, 3, 4]);
  assert.ok(out.subarray(4).every((b) => b === 0));
  // 어림 길이에도 무음을 넣는다(음성을 만들기 전 챕터 길이)
  const est = estimateTimeline([{ text: '안녕하세요.' }]);
  assert.ok(est.durationMs - est.lineTimesMs[0]!.endMs >= SEGMENT_TAIL_MS);
});

test('앞뒤 무음 자르기: 소리 앞뒤로 keepMs만 남기고, 다 무음이면 그대로', () => {
  // 1kHz에서 무음 100ms + 소리 50ms + 무음 200ms
  const rate = 1000;
  const pcm = new Uint8Array((100 + 50 + 200) * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 100; i < 150; i++) view.setInt16(i * 2, i % 2 ? 8000 : -8000, true);
  const out = trimSilence(pcm, rate, 20);
  assert.equal(out.length, (20 + 50 + 20) * 2);
  assert.equal(new DataView(out.buffer, out.byteOffset).getInt16(20 * 2, true), 8000 * (100 % 2 ? 1 : -1));
  const quiet = new Uint8Array(200);
  assert.equal(trimSilence(quiet, rate, 20), quiet);
});
