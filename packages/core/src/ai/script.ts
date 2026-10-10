import type { ScriptLine } from '../types';
import type { ScriptInput } from './types';

// 말투별 듣기 대본. LLM 없이 요약 본문을 그대로 읽고 앞뒤에 짧은 연결 문장만 붙인다(대본 호출 비용 0).
// 순서 문장("세 번째 소식")은 넣지 않는다. 같은 소식·토픽·말투면 누가 듣든 대본이 같아서 음성을 한 번만 만든다.

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 'OO라면: 본문' → 'OO라면, 본문' (말로 읽을 때) */
function spokenWhy(why: string): string {
  return why.replace(/:\s*/, ', ');
}

function withPeriod(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

/** 본문을 문장 단위 줄로 나누고, 각 줄에 문단 번호를 단다 */
function bodyLines(body: string[]): ScriptLine[] {
  return body.flatMap((p, para) => splitSentences(p).map((text) => ({ text, para })));
}

export function templateScript(input: ScriptInput): ScriptLine[] {
  const why = spokenWhy(input.why);
  switch (input.persona) {
    case 'announcer':
      return [{ text: withPeriod(input.title) }, ...bodyLines(input.body), { text: why }];
    case 'teacher':
      return [
        { text: `이번엔 ${input.topicName} 이야기예요.` },
        { text: withPeriod(input.title) },
        ...bodyLines(input.body),
        { text: `정리하면, ${why}` },
      ];
    case 'dialogue': {
      const asks = ['조금 더 풀어 주세요.', '그다음은요?', '마지막으로 하나만 더요.'];
      const lines: ScriptLine[] = [{ who: '진행자', text: `이번 소식은 뭔가요?` }];
      input.body.forEach((p, para) => {
        if (para > 0) lines.push({ who: '진행자', text: asks[Math.min(para - 1, asks.length - 1)]! });
        lines.push({ who: '해설자', text: p, para });
      });
      lines.push({ who: '진행자', text: '그래서 왜 중요한 거예요?' }, { who: '해설자', text: why });
      return lines;
    }
  }
}
