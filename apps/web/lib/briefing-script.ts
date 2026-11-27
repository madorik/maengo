import { SLOT_LABEL, type BriefingSlot } from '@maengo/core/sections';
import type { ScriptLine } from '@maengo/core/types';
import type { BriefingInsight } from './server/briefing-insight';

// 브리핑 음성의 대본(2026-11-27 사용자: 오늘 브리핑도 핵심 요약만 음성으로, 알림으로 들어오면 브리핑부터 듣고 자연스럽게 다음 뉴스로).
// 오늘 듣기 맨 앞 챕터로 붙는다(lib/server/episode.ts). 오늘의 인사이트에서 핵심 요약만 읽는다:
// '출근길 브리핑입니다.' → 인사이트 한 줄(headline) → 흐름마다 제목과 핵심 요약 두 줄(points) → '이어서 소식을 하나씩 들려 드릴게요.'
// 나에게 미칠 영향(effect)·근거 사실(lead)·챙겨 볼 것은 읽지 않는다(핵심 요약만)

/** 소리 내어 읽기 좋게: 예전 형식에 남은 호칭('OO님이')은 뗀다(이름을 TTS에 보내지 않는다), 공백을 한 칸으로, 끝에 마침표 */
function spoken(s: string | undefined): string {
  const t = (s ?? '')
    .replace(/(?:OO|○○|회원)님(?:이|의|은|께서|께)?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  return /[.?!…]$/.test(t) ? t : `${t}.`;
}

/** 흐름의 핵심 요약 줄. 형식 14 전의 흐름은 points가 없어서 핵심 사실(fact), 그것도 없으면 설명(text)의 첫 문장 */
function pointsOf(flow: BriefingInsight['flows'][number]): string[] {
  if (flow.points?.length) return flow.points.slice(0, 2);
  if (flow.fact) return [flow.fact];
  const first = flow.text?.split(/(?<=[.?!])\s+/)[0];
  return first ? [first] : [];
}

/** 브리핑 대본. 흐름마다 한 문단(제목·요약 줄을 한 번에 읽는다), 문단 사이는 TTS가 조금 더 쉰다. 읽을 흐름이 없으면 빈 목록 */
export function briefingScript(insight: Pick<BriefingInsight, 'headline' | 'flows'>, slot: BriefingSlot): ScriptLine[] {
  const flows = insight.flows
    .map((f, para) => ({ para, lines: [spoken(f.title), ...pointsOf(f).map(spoken)].filter(Boolean) }))
    .filter((f) => f.lines.length > 1);
  if (!flows.length) return [];
  const headline = spoken(insight.headline);
  return [
    { text: `${SLOT_LABEL[slot]} 브리핑입니다.` },
    ...(headline ? [{ text: headline }] : []),
    ...flows.flatMap((f) => f.lines.map((text) => ({ text, para: f.para }))),
    { text: '이어서 소식을 하나씩 들려 드릴게요.' },
  ];
}

/** 플레이어에 보이는 브리핑 챕터 이름 */
export function briefingTitle(slot: BriefingSlot): string {
  return `${SLOT_LABEL[slot]} 브리핑`;
}
