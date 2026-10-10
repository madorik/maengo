// 웹과 파이프라인이 같이 쓰는 도메인 타입. DB 스키마(PLAN.md 4장)의 체크 제약과 값이 같다.
// 직업은 받지 않는다. 개인화는 관심 토픽만으로 한다(2026-10-09 결정).

/** Free·Premium. Premium은 가입 후 1주일, 또는 결제 기간 동안(profiles.premium_until) */
export type Plan = 'free' | 'plus';

/** AI 모델 등급. Free는 basic(Gemini Flash), Premium은 pro(상위 모델). */
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
  /** 상세 관심사면 큰 분류 id(예: 'postgres' → 'backend'). 큰 분류면 없음 */
  parent?: string;
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
