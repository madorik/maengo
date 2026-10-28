// 웹과 파이프라인이 같이 쓰는 도메인 타입. DB 스키마(PLAN.md 4장)의 체크 제약과 값이 같다.
// 직업은 받지 않는다. 개인화는 관심 토픽만으로 한다(2026-10-09 결정).

/** Free·Premium. Premium은 가입 후 1주일, 또는 결제 기간 동안(profiles.premium_until) */
export type Plan = 'free' | 'plus';

/** AI 모델 등급. Free는 basic(Gemini Flash), Premium은 pro(상위 모델). */
export type Tier = 'basic' | 'pro';

/**
 * 듣기 말투. 2026-10-10부터 아나운서 하나만 쓰고, 선생님·대담은 2026-10-28에 지웠다(제공하지 않기로, 사용자 결정).
 * 음성 캐시 키(apps/web lib/server/episode.ts segmentKey)에 들어가서 이름은 그대로 둔다. DB 체크 제약(profiles·audio_segments)엔 예전 값이 남아 있다
 */
export type Persona = 'announcer';
export type Voice = 'f' | 'm';

export type FeedbackKind = 'more' | 'known' | 'skip';

export interface Topic {
  id: string;
  name: string;
  aliases: string[];
  /** 상세 관심사면 큰 분류 id(예: 'bitcoin' → 'coin'). 큰 분류면 없음 */
  parent?: string;
}

export interface ScriptLine {
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
