import type { Persona, Voice } from '../types';

/** 말투는 아나운서 하나다. 사용자는 목소리(여성·남성)만 고른다(TTS 비용: 소식마다 음성 2개까지). 선생님·대담은 2026-10-28에 지웠다 */
export const PERSONA: Persona = 'announcer';

export const VOICES: { id: Voice; label: string }[] = [
  { id: 'f', label: '여성' },
  { id: 'm', label: '남성' },
];

/** 줄 사이 쉼. TTS 출력에도 같은 쉼을 넣는다. */
export const LINE_GAP_MS = 450;
/** 항목 시작 전 여백(더미 음성에서는 차임이 들어가는 자리) */
export const SEGMENT_LEAD_MS = 400;
/** 소식 음성 끝에 붙이는 무음. 다음 소식이 바로 이어 시작되지 않게 하는 쉼(2026-10-25 사용자 결정, 같은 날 2초→1초) */
export const SEGMENT_TAIL_MS = 1000;
const MIN_LINE_MS = 900;

/** 대본 길이로 재생 시간을 어림할 때 쓰는 초당 글자 수(공백 포함, 아나운서) */
const CHARS_PER_SECOND = 7.5;

export function estimateLineMs(text: string): number {
  return Math.max(MIN_LINE_MS, Math.round((text.length / CHARS_PER_SECOND) * 1000));
}

/** 대본 한 세그먼트의 줄별 시각과 전체 길이. 실제 TTS 결과가 없을 때의 어림값이다. */
export function estimateTimeline(lines: { text: string }[]) {
  const lineTimesMs: { startMs: number; endMs: number }[] = [];
  let at = SEGMENT_LEAD_MS;
  for (const line of lines) {
    const ms = estimateLineMs(line.text);
    lineTimesMs.push({ startMs: at, endMs: at + ms });
    at += ms + LINE_GAP_MS;
  }
  return { lineTimesMs, durationMs: at + SEGMENT_TAIL_MS };
}
