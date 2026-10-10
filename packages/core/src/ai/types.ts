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
  /** 'RAG에 관심 있다면' (whyLead) */
  lead: string;
}

export interface ScriptInput {
  model: string;
  persona: Persona;
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

export interface ScreenInterestInput {
  model: string;
  /** 사용자가 기타에 적은 말(1~3개) */
  phrases: string[];
  /** 화면에서 기다리는 검사라 짧게 끊는다(기본 6초) */
  timeoutMs?: number;
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
  /** 기타에 적은 말 중 성인 콘텐츠 관련어가 있는지. 실패하면 던진다(부르는 쪽이 통과로 처리) */
  screenInterest(input: ScreenInterestInput): Promise<{ adult: boolean }>;
  script(input: ScriptInput): Promise<ScriptLine[]>;
  speak(input: SpeakInput): Promise<SpeakOutput>;
}

// ---- 파이프라인(요약·임베딩). Gemini 구현만 있다 ----

export interface SummarizeSource {
  title: string;
  sourceName: string;
  url: string;
  author?: string | null;
  publishedAt?: string | null;
  /** 본문(또는 본문을 못 읽었으면 RSS 설명). 호출하는 쪽이 길이를 자른다 */
  text: string;
}

export interface SummarizeInput {
  model: string;
  kind: 'article' | 'video';
  /** 같은 소식을 다룬 글들. 첫 번째가 대표 */
  sources: SummarizeSource[];
  /** 영상이면 유튜브 주소. 모델이 영상을 직접 본다 */
  videoUrl?: string;
  /** 고를 수 있는 토픽 사전 */
  dictionary: readonly Topic[];
}

export interface SummarizeOutput {
  /** 소식이 아니면(광고·채용·본문 없음) 이유를 담아 돌려준다. 나머지 칸은 비어 있을 수 있다 */
  skip: string | null;
  title: string;
  short: string;
  body: string[];
  category: CategoryId;
  author: string;
  topics: { topicId: string; relevance: number }[];
  /** 토픽별 "왜 중요한가" 본문(앞머리 제외) */
  why: { topicId: string; text: string }[];
  scenes?: { t: string; label: string }[];
}

export type UsageKind = 'summary' | 'why' | 'script' | 'tts' | 'embed' | 'video' | 'topic_map' | 'classify' | 'screen';

export interface UsageEvent {
  model: string;
  kind: UsageKind;
  inputTokens: number;
  outputTokens: number;
  /** 생각 토큰. 출력 요금으로 청구된다 */
  thinkingTokens: number;
}
