import type { Persona, Voice, VoiceKey } from '../types';

export interface PersonaInfo {
  id: Persona;
  name: string;
  /** 데스크톱 패널용 설명 */
  desc: string;
  /** 모바일 시트용 짧은 설명 */
  shortDesc: string;
  /** 대본 길이로 재생 시간을 어림할 때 쓰는 초당 글자 수(공백 포함) */
  charsPerSecond: number;
}

export const PERSONAS: PersonaInfo[] = [
  { id: 'announcer', name: '아나운서', desc: '핵심만 빠르게', shortDesc: '핵심만', charsPerSecond: 7.5 },
  { id: 'teacher', name: '선생님', desc: '개념부터 풀어서, 마지막에 복습까지', shortDesc: '풀어서', charsPerSecond: 6.5 },
  { id: 'dialogue', name: '대담', desc: '두 사람이 묻고 답하며', shortDesc: '묻고 답하며', charsPerSecond: 7 },
];

export const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map((p) => [p.id, p])) as Record<Persona, PersonaInfo>;

export const VOICES: { id: Voice; label: string }[] = [
  { id: 'f', label: '여성' },
  { id: 'm', label: '남성' },
];

export function voiceKey(persona: Persona, voice: Voice): VoiceKey {
  return persona === 'dialogue' ? 'pair' : voice;
}

/** 줄 사이 쉼. TTS 출력에도 같은 쉼을 넣는다. */
export const LINE_GAP_MS = 450;
/** 항목 시작 전 여백(더미 음성에서는 차임이 들어가는 자리) */
export const SEGMENT_LEAD_MS = 400;
const MIN_LINE_MS = 900;

export function estimateLineMs(text: string, persona: Persona): number {
  return Math.max(MIN_LINE_MS, Math.round((text.length / PERSONA_BY_ID[persona].charsPerSecond) * 1000));
}

/** 대본 한 세그먼트의 줄별 시각과 전체 길이. 실제 TTS 결과가 없을 때의 어림값이다. */
export function estimateTimeline(lines: { text: string }[], persona: Persona) {
  const lineTimesMs: { startMs: number; endMs: number }[] = [];
  let at = SEGMENT_LEAD_MS;
  for (const line of lines) {
    const ms = estimateLineMs(line.text, persona);
    lineTimesMs.push({ startMs: at, endMs: at + ms });
    at += ms + LINE_GAP_MS;
  }
  return { lineTimesMs, durationMs: at };
}
