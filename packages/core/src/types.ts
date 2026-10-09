// 웹과 파이프라인이 같이 쓰는 도메인 타입. DB 스키마(PLAN.md 4장)의 체크 제약과 값이 같다.

export const JOBS = [
  'backend', 'frontend', 'mobile', 'data', 'infra',
  'pm', 'design', 'marketing', 'student', 'other',
] as const;
export type Job = (typeof JOBS)[number];

/** trial은 플러스 체험이다. 권한과 AI 등급은 plus와 같다. */
export type Plan = 'free' | 'trial' | 'plus';

/** AI 모델 등급. 무료는 basic(Gemini Flash), 플러스·체험은 pro(상위 모델). */
export type Tier = 'basic' | 'pro';

export type Persona = 'announcer' | 'teacher' | 'dialogue';
export type Voice = 'f' | 'm';
/** 대담은 두 목소리를 같이 쓰므로 목소리 대신 pair로 캐시한다. */
export type VoiceKey = Voice | 'pair';

export type FeedbackKind = 'more' | 'known' | 'skip';

export interface Topic {
  id: string;
  name: string;
  aliases: string[];
}

export interface ScriptLine {
  /** 대담일 때만 '진행자' | '해설자' */
  who?: string;
  text: string;
  /** 본문 몇 번째 문단을 읽는 줄인지. 상세 화면에서 그 문단을 짚어 준다 */
  para?: number;
}

export interface TimedLine extends ScriptLine {
  startMs: number;
  endMs: number;
}

export interface Chapter {
  rank: number;
  clusterId: number;
  title: string;
  startMs: number;
  endMs: number;
  lines: TimedLine[];
}
