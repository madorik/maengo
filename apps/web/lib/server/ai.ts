import 'server-only';
import { createDummyAi, GEMINI_MODELS, type AiClient, type UsageEvent } from '@maengo/core/ai';
import { createGeminiAi } from '@maengo/core/gemini';
import { db } from './db';
import type { Persona, VoiceKey } from '@maengo/core/types';
import { chirpVoiceId, createGoogleTts, type TtsClient } from './google-tts';

// 웹은 요약·why를 만들지 않는다(파이프라인이 만든다). 문장→토픽은 키워드 매칭(더미, 비용 0).
export const ai = createDummyAi();

// 듣기 음성(사용자가 듣기를 누를 때만, 만든 음성은 캐시, episode.ts)은 Google Cloud TTS Chirp 3 HD로 만든다(GOOGLE_TTS_API_KEY).
// 그 키가 없으면 Gemini TTS, 그것도 없으면 더미 신호음. Gemini는 기타 관심사의 성인 관련어 검사(topics.ts)와 내 관심 링크 사이트 검사(links.ts)에도 쓴다.
const key = process.env.GEMINI_API_KEY?.trim();
const googleTtsKey = process.env.GOOGLE_TTS_API_KEY?.trim();

// 100만 토큰당 달러(추정치, core/ai/models.ts의 고정 모델 단가). TTS는 2027-01-01부터 두 배
const PRICE = { tts: { input: 0.5, output: 6 }, text: { input: 0.25, output: 1.5 } };

function logUsage(e: UsageEvent) {
  const price = e.kind === 'tts' ? PRICE.tts : PRICE.text;
  const usd = (e.inputTokens * price.input + (e.outputTokens + e.thinkingTokens) * price.output) / 1e6;
  void db
    .from('usage_log')
    .insert({ provider: 'gemini', kind: e.kind, units: e.inputTokens + e.outputTokens, est_usd: Number(usd.toFixed(4)) })
    .then(({ error }) => error && console.error('usage_log', error.message));
}

const gemini = key ? createGeminiAi({ apiKey: key, onUsage: logUsage, log: (m) => console.log(`[gemini] ${m}`) }) : null;

/** Chirp 3 HD는 글자 수 과금(100만 자당 $30, 매월 100만 자 무료라 무료 한도 안이면 실제 청구 0) */
function logTtsChars(chars: number) {
  void db
    .from('usage_log')
    .insert({ provider: 'google', kind: 'tts', units: chars, est_usd: Number(((chars * 30) / 1e6).toFixed(4)) })
    .then(({ error }) => error && console.error('usage_log', error.message));
}

export const tts: TtsClient = googleTtsKey ? createGoogleTts({ apiKey: googleTtsKey, onChars: logTtsChars }) : (gemini ?? ai);
export const screener: Pick<AiClient, 'provider' | 'screenInterest' | 'screenSite'> = gemini ?? ai;

/** 관심사·내 관심 링크 검사 모델(고정 버전) */
export function screenModel(): string {
  return GEMINI_MODELS.screen;
}

/** 실제 목소리 이름(Chirp 3 HD일 때만). 음성 캐시 키에 들어가서, 목소리를 바꾸면 새로 만든다 */
export function ttsVoiceId(persona: Persona, vk: VoiceKey): string | undefined {
  return googleTtsKey ? chirpVoiceId(persona, vk) : undefined;
}

/** 음성 모델 이름. 음성 캐시 키에 들어가서, 모델을 바꾸면 새로 만든다 */
export function ttsModel(): string {
  if (googleTtsKey) return 'chirp3-hd';
  return GEMINI_MODELS.tts;
}
