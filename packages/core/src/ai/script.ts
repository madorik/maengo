import type { ScriptLine } from '../types';
import { josa } from '../util/josa';
import type { ScriptInput } from './types';

// 듣기 대본(아나운서). LLM 없이 요약 본문을 그대로 읽고 앞뒤에 짧은 연결 문장만 붙인다(대본 호출 비용 0).
// 순서 문장("세 번째 소식")은 넣지 않는다. 관심사도 읽지 않아서 같은 소식이면 누가 듣든 대본이 같고 음성을 목소리별로 한 번만 만든다.

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function withPeriod(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

/** 본문을 문장 단위 줄로 나누고, 각 줄에 문단 번호를 단다 */
function bodyLines(body: string[]): ScriptLine[] {
  return body.flatMap((p, para) => splitSentences(p).map((text) => ({ text, para })));
}

/**
 * 마지막 줄: '정리하면, (제목)이라는 소식이었습니다.' 제목 끝 문장부호는 떼고 받침에 맞춰 '이라는·라는'.
 * 관심사별 why는 읽지 않는다(2026-10-25 사용자 결정). 그래서 같은 소식·목소리면 관심사가 달라도 음성이 같다
 */
export function closingLine(title: string): string {
  const t = title.trim().replace(/[\s.…!?,'"“”‘’]+$/u, '');
  return `정리하면, ${josa(t, '이라는', '라는')} 소식이었습니다.`;
}

/** 제목, 본문(문장마다 한 줄), '정리하면, (제목)이라는 소식이었습니다.' */
export function templateScript(input: ScriptInput): ScriptLine[] {
  return [{ text: withPeriod(input.title) }, ...bodyLines(input.body), { text: closingLine(input.title) }];
}
