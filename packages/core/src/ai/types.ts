import type { CategoryId } from '../categories';
import type { Persona, ScriptLine, Topic, VoiceKey } from '../types';

export interface WhyInput {
  model: string;
  clusterId: number;
  title: string;
  short: string;
  body: string[];
  topicId: string;
  topicName: string;
  /** '백엔드 개발자라면' */
  jobLead: string;
}

export interface ScriptInput {
  model: string;
  persona: Persona;
  /** 1부터. '세 번째 소식' 같은 연결 문장에 쓴다 */
  rank: number;
  topicName: string;
  title: string;
  short: string;
  /** 전체 글(문단 단위). 듣기는 이 본문을 읽는다 */
  body: string[];
  why: string;
}

export interface ClassifyInput {
  model: string;
  title: string;
  short: string;
  body: string[];
}

export interface MapTopicsInput {
  model: string;
  /** 유저가 적은 관심사 문장 */
  text: string;
  /** 고를 수 있는 토픽 사전. 여기 없는 id는 돌려주지 않는다 */
  dictionary: readonly Topic[];
}

export interface SpeakInput {
  model: string;
  persona: Persona;
  voice: VoiceKey;
  lines: ScriptLine[];
}

export interface SpeakOutput {
  /** 모노 PCM. sampleRate·bitsPerSample은 같은 에피소드 안에서 모두 같아야 이어 붙일 수 있다 */
  pcm: Uint8Array;
  sampleRate: number;
  bitsPerSample: 8 | 16;
  /** 각 줄이 시작·끝나는 시각(세그먼트 기준) */
  lineTimesMs: { startMs: number; endMs: number }[];
  durationMs: number;
}

/** 웹과 파이프라인이 부르는 AI 기능. 구현은 지금 더미 하나, 키가 들어오면 Gemini를 붙인다. */
export interface AiClient {
  readonly provider: 'dummy' | 'gemini';
  why(input: WhyInput): Promise<string>;
  /** 글 카테고리 하나. 클러스터마다 한 번만 부르고 캐시한다 */
  classify(input: ClassifyInput): Promise<CategoryId>;
  /** 관심사 문장 → 토픽 id(최대 3개). 맞는 게 없으면 빈 배열 */
  mapTopics(input: MapTopicsInput): Promise<string[]>;
  script(input: ScriptInput): Promise<ScriptLine[]>;
  speak(input: SpeakInput): Promise<SpeakOutput>;
}
