import 'server-only';
import { noReasoningModels, openaiChatJson, openAiUsage, type OpenAiJsonInput, type OpenAiUsage } from '@maengo/core/openai';
import { gptLive } from '../site';
import { db } from './db';

// OpenAI Responses API로 JSON 한 번 받기(2026-11-13, 오늘의 흐름·맞춤 체크를 gpt-6-luna로. lib/server/briefing-insight.ts).
// 2026-11-25: JSON 호출 본체는 주간 리포트(파이프라인)와 같이 쓰려고 packages/core/src/ai/openai.ts로 옮겼다. 여기는 키 확인·사용량 기록·흘려 보내기.
// - 구조화 출력(strict)으로 스키마를 지키게 한다(lib/openai-schema.ts).
// - store:false — OpenAI 쪽에 응답을 남기지 않는다(개인정보 처리방침 5조 OpenAI).
// - 생각 수준은 낮게(Gemini 쪽 LOW와 맞춤). 그 설정을 받지 않는 모델이면(400) 빼고 다시 부르고, 다음부터는 빼고 부른다.
// - 잠깐의 혼잡(429 속도 제한·5xx)이면 한 번 더. 크레딧이 다 떨어졌으면(insufficient_quota·credit_balance_exhausted) 바로 실패 → 부르는 쪽이 Gemini로 만든다.
// - 사용량은 usage_log(provider 'openai')에 남긴다. Gemini 하루 지출 상한(GEMINI_DAILY_USD_CAP)에는 잡히지 않는다(provider가 다르다)
// - 같은 날 맹고 AI(소식 물어보기 답·추천 질문)도 OpenAI로(사용자 '질문하는 것도 GPT로 바꾸자'). 답은 openaiStream으로 흘려 보낸다

/**
 * OpenAI로 보내도 되는지: 키가 있고, 끄지 않았고(AI_PROVIDER=gemini면 끔), OpenAI를 적은 개인정보 처리방침이 시행됐는지(lib/site.ts PRIVACY_EFFECTIVE_ON, 한국 날짜).
 * 로컬 개발 서버(로컬 Supabase의 데모 데이터)는 시행일 전에도 쓴다. 안 되면 null → 부르는 쪽이 Gemini로
 */
export function openAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || process.env.AI_PROVIDER?.trim() === 'gemini') return null;
  return gptLive() ? key : null;
}

const URL = 'https://api.openai.com/v1/responses';
/** 생각 수준 설정을 받지 않는 모델(JSON 호출과 같이 쓴다) */
const noReasoning = noReasoningModels;

export type { OpenAiJsonInput };

/** JSON 한 번(공용 openaiChatJson) + 사용량을 usage_log에 */
export function openaiJson<T>(input: OpenAiJsonInput): Promise<T> {
  return openaiChatJson<T>({ ...input, onUsage: saveOpenAiUsage });
}

/** 호출 하나의 사용량과 추정 비용(생각 토큰은 출력 단가)을 usage_log에 */
function saveOpenAiUsage(u: OpenAiUsage) {
  void db
    .from('usage_log')
    .insert({ provider: 'openai', kind: u.kind, units: u.inputTokens + u.outputTokens, est_usd: Number(u.usd.toFixed(4)) })
    .then(({ error }) => error && console.error('usage_log openai', error.message));
}

export interface OpenAiStreamInput {
  apiKey: string;
  model: string;
  kind: string;
  system: string;
  /** 앞선 대화와 이번 질문(model = 맹고 AI가 한 말) */
  turns: { role: 'user' | 'model'; text: string }[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * 답을 조각으로 받는다(Responses API stream, SSE). 첫 조각 전에 실패하면 예외 → 부르는 쪽이 Gemini로 다시 할 수 있다.
 * 생각 수준은 낮게(받지 않는 모델이면 빼고 한 번 더), store:false, 다 받으면 사용량을 남긴다
 */
export async function* openaiStream(input: OpenAiStreamInput): AsyncGenerator<string> {
  const { apiKey, model, kind, system, turns, timeoutMs = 25_000 } = input;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = input.signal ? AbortSignal.any([timeout, input.signal]) : timeout;
  const messages = turns.map((t) => ({ role: t.role === 'model' ? 'assistant' : 'user', content: t.text }));
  const call = (reasoning: boolean) =>
    fetch(URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, instructions: system, input: messages, store: false, stream: true, ...(reasoning ? { reasoning: { effort: 'low' } } : {}) }),
      signal,
    });
  let res = await call(!noReasoning.has(model));
  if (res.status === 400 && !noReasoning.has(model)) {
    const err = await res.text();
    if (/reasoning/i.test(err)) {
      noReasoning.add(model);
      res = await call(false);
    } else throw new Error(`openai 400 ${err.slice(0, 200)}`);
  }
  if (!res.ok || !res.body) throw new Error(`openai ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let wrote = false;
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE: 빈 줄로 나뉜 이벤트마다 'data: {json}'
      let cut: number;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!data || data === '[DONE]') continue;
        let ev: { type?: string; delta?: string; response?: { usage?: typeof usage; error?: { message?: string } }; error?: { message?: string }; message?: string };
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.type === 'response.output_text.delta' && ev.delta) {
          wrote = true;
          yield ev.delta;
        } else if (ev.type === 'response.completed') usage = ev.response?.usage;
        else if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(`openai 실패 ${ev.response?.error?.message ?? ev.error?.message ?? ev.message ?? ''}`.slice(0, 200));
      }
    }
  } finally {
    reader.releaseLock();
    if (usage) saveOpenAiUsage(openAiUsage(kind, model, usage));
  }
  if (!wrote) throw new Error('openai 빈 답');
}
