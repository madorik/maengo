import { OPENAI_PRICE } from './models';

// OpenAI Responses API로 JSON 한 번 받기(웹·파이프라인 공용, 2026-11-25에 apps/web/lib/server/openai.ts에서 옮김).
// - 오늘의 흐름·맞춤 체크(웹)와 주간 리포트(pipeline/src/reports.ts, 2026-12-02 처리방침 시행부터)가 쓴다.
// - 구조화 출력(strict)으로 스키마를 지키게 한다(strictSchema: Gemini용 스키마를 그대로 넘기려고 바꿔 보낸다).
// - store:false — OpenAI 쪽에 응답을 남기지 않는다(개인정보 처리방침 5조 OpenAI).
// - 생각 수준은 낮게(Gemini 쪽 LOW와 맞춤). 그 설정을 받지 않는 모델이면(400) 빼고 다시 부르고, 다음부터는 빼고 부른다.
// - 잠깐의 혼잡(429 속도 제한·5xx)이면 다시. 크레딧이 다 떨어졌으면(insufficient_quota·credit_balance_exhausted) 바로 실패 → 부르는 쪽이 Gemini로 만든다.
// - 시간 초과는 다시 부르지 않는다(부르는 쪽이 Gemini로). 사용량은 onUsage로 넘긴다(DB에 남기는 건 부르는 쪽, usage_log provider 'openai')

const URL = 'https://api.openai.com/v1/responses';
/** 생각 수준 설정을 받지 않는 모델(한 번 400을 받으면 이 서버 인스턴스에서는 빼고 부른다) */
export const noReasoningModels = new Set<string>();
const NO_CREDIT = /insufficient_quota|credit_balance_exhausted|billing/;

/** OpenAI 구조화 출력(strict json_schema)에 맞게: 객체마다 additionalProperties:false, 모든 속성을 required로 */
export function strictSchema<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map(strictSchema) as T;
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) out[k] = strictSchema(v);
    if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties);
    }
    return out as T;
  }
  return schema;
}

export interface OpenAiUsage {
  kind: string;
  model: string;
  inputTokens: number;
  /** 생각 토큰을 포함한 출력 토큰(출력 단가로 매긴다) */
  outputTokens: number;
  /** 추정 비용(달러, OPENAI_PRICE) */
  usd: number;
}

export interface OpenAiJsonInput {
  apiKey: string;
  model: string;
  /** usage_log kind(예: 'insight', 'report') */
  kind: string;
  system: string;
  user: string;
  schema: object;
  /** 스키마 이름(영문·밑줄) */
  name: string;
  timeoutMs?: number;
  /** 생각 수준(기본 low). 채울 칸이 많은 주간 리포트는 medium */
  effort?: 'low' | 'medium';
  onUsage?: (u: OpenAiUsage) => void;
}

/** 호출 하나의 사용량과 추정 비용 */
export function openAiUsage(kind: string, model: string, u?: { input_tokens?: number; output_tokens?: number }): OpenAiUsage {
  const inputTokens = u?.input_tokens ?? 0;
  const outputTokens = u?.output_tokens ?? 0;
  const price = OPENAI_PRICE[model] ?? { input: 0, output: 0 };
  return { kind, model, inputTokens, outputTokens, usd: (inputTokens * price.input + outputTokens * price.output) / 1e6 };
}

export async function openaiChatJson<T>(input: OpenAiJsonInput): Promise<T> {
  const { apiKey, model, kind, system, user, schema, name, timeoutMs = 25_000, effort = 'low', onUsage } = input;
  const format = { type: 'json_schema', name, schema: strictSchema(schema), strict: true };
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const reasoning = !noReasoningModels.has(model);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, instructions: system, input: user, store: false, text: { format }, ...(reasoning ? { reasoning: { effort } } : {}) }),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
        output?: { content?: { type?: string; text?: string }[] }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const code = json.error?.code ?? '';
      lastError = `openai ${res.status} ${code} ${String(json.error?.message ?? '').slice(0, 160)}`;
      if (res.status === 400 && reasoning && /reasoning/i.test(JSON.stringify(json.error ?? ''))) {
        noReasoningModels.add(model);
        continue;
      }
      if (!res.ok) {
        const retry = (res.status === 429 && !NO_CREDIT.test(`${code} ${json.error?.message ?? ''}`)) || res.status >= 500;
        if (retry && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw new Error(lastError);
      }
      onUsage?.(openAiUsage(kind, model, json.usage));
      const text = (json.output ?? []).flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text;
      if (!text) throw new Error('openai 빈 응답');
      return JSON.parse(text) as T;
    } catch (e) {
      const err = e as Error;
      if (err?.name === 'AbortError') throw new Error(`openai 시간 초과 ${timeoutMs}ms`);
      // 네트워크가 잠깐 끊긴 것(fetch TypeError)만 한 번 더
      if (err?.name === 'TypeError' && attempt < 3) {
        lastError = `openai 연결 실패 ${err.message}`;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError || 'openai 실패');
}
