import 'server-only';
import { createDummyAi, type AiClient, type UsageEvent } from '@maengo/core/ai';
import { createGeminiAi } from '@maengo/core/gemini';
import { db } from './db';

// 웹은 요약·why를 만들지 않는다(파이프라인이 만든다). 문장→토픽은 키워드 매칭(더미, 비용 0).
export const ai = createDummyAi();

// 듣기 음성만 Gemini TTS로 만든다. 사용자가 듣기를 누를 때만 부르고, 만든 음성은 캐시한다(episode.ts).
// 키가 없으면 차임·신호음 더미 음성.
const key = process.env.GEMINI_API_KEY?.trim();

// 100만 토큰당 달러(추정치, Gemini 2.5 Flash TTS 단가 기준). 무료 등급 키면 실제 청구 0
const TTS_PRICE = { input: 0.5, output: 10 };

function logUsage(e: UsageEvent) {
  const usd = (e.inputTokens * TTS_PRICE.input + e.outputTokens * TTS_PRICE.output) / 1e6;
  void db
    .from('usage_log')
    .insert({ provider: 'gemini', kind: e.kind, units: e.inputTokens + e.outputTokens, est_usd: Number(usd.toFixed(4)) })
    .then(({ error }) => error && console.error('usage_log', error.message));
}

export const tts: Pick<AiClient, 'provider' | 'speak'> = key
  ? createGeminiAi({ apiKey: key, onUsage: logUsage, log: (m) => console.log(`[tts] ${m}`) })
  : ai;

/** 오디오 음성 모델. 2026-10-09 무료 등급 키로 동작 확인 */
export function ttsModel(): string {
  return process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-3.8-flash-tts';
}
