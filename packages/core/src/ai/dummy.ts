import { estimateTimeline } from '../audio/personas';
import { classifyByKeywords } from '../categories';
import { isAdultInterest } from '../topics/interests';
import { matchTopics } from '../topics/match';
import { templateScript } from './script';
import type { AiClient, ClassifyInput, MapTopicsInput, ScreenInterestInput, ScriptInput, SpeakInput, SpeakOutput, WhyInput } from './types';

// API 키 없이 화면과 흐름을 끝까지 돌려 보기 위한 더미. 같은 입력이면 늘 같은 결과를 낸다.
// 음성은 실제 말 대신 항목 시작에 차임, 문장마다 짧은 신호음을 넣고 나머지는 무음으로 채운다.
// 문장 길이로 재생 시간을 어림하므로 챕터·진행 막대·대본 하이라이트는 실제와 같은 방식으로 움직인다.

export interface DummyCanned {
  /** 파이프라인이 미리 만들어 둔 why 본문(앞머리 제외)이 있으면 그것을 쓴다 */
  whyBody?: (clusterId: number, topicId: string) => string | undefined;
}

const SAMPLE_RATE = 8000;

const PITCH: Record<string, number> = { f: 880, m: 587, 진행자: 784, 해설자: 523 };

function tone(pcm: Uint8Array, atMs: number, ms: number, freq: number, amp: number) {
  const start = Math.floor((atMs / 1000) * SAMPLE_RATE);
  const n = Math.floor((ms / 1000) * SAMPLE_RATE);
  for (let i = 0; i < n && start + i < pcm.length; i++) {
    const t = i / SAMPLE_RATE;
    const v = (pcm[start + i] ?? 128) + amp * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 18);
    pcm[start + i] = Math.max(0, Math.min(255, Math.round(v)));
  }
}

export function dummySpeak(input: SpeakInput): SpeakOutput {
  const { lineTimesMs, durationMs } = estimateTimeline(input.lines, input.persona);
  const pcm = new Uint8Array(Math.ceil((durationMs / 1000) * SAMPLE_RATE)).fill(128);

  const base = PITCH[input.voice === 'pair' ? '진행자' : input.voice] ?? 880;
  tone(pcm, 0, 160, base, 46);
  tone(pcm, 170, 220, base * 1.5, 46);
  input.lines.forEach((line, i) => {
    const pitch = (line.who && PITCH[line.who]) || base;
    tone(pcm, lineTimesMs[i]!.startMs, 70, pitch * 0.75, 20);
  });

  return { pcm, sampleRate: SAMPLE_RATE, bitsPerSample: 8, lineTimesMs, durationMs };
}

export function createDummyAi(canned: DummyCanned = {}): AiClient {
  return {
    provider: 'dummy',
    async why(input: WhyInput) {
      const body =
        canned.whyBody?.(input.clusterId, input.topicId) ??
        `${input.topicName} 쪽에서 지금 하는 일과 바로 비교해 볼 만해요.`;
      return `${input.lead}: ${body}`;
    },
    async classify(input: ClassifyInput) {
      return classifyByKeywords(input);
    },
    async mapTopics(input: MapTopicsInput) {
      return matchTopics(input.text, input.dictionary);
    },
    async screenInterest(input: ScreenInterestInput) {
      return { adult: input.phrases.some(isAdultInterest) };
    },
    async script(input: ScriptInput) {
      return templateScript(input);
    },
    async speak(input: SpeakInput) {
      return dummySpeak(input);
    },
  };
}
