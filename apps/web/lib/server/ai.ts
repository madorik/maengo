import 'server-only';
import { createDummyAi, GEMINI_MODELS, type AiClient, type UsageEvent } from '@maengo/core/ai';
import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { db } from './db';
import type { Voice } from '@maengo/core/types';
import { chirpVoiceId, createGoogleTts, type TtsClient } from './google-tts';

// 웹은 요약·why를 만들지 않는다(파이프라인이 만든다). 문장→토픽은 키워드 매칭(더미, 비용 0).
export const ai = createDummyAi();

// 듣기 음성(사용자가 듣기를 누를 때만, 만든 음성은 캐시, episode.ts)은 Free는 Google Cloud TTS Chirp 3 HD(GOOGLE_TTS_API_KEY),
// Premium은 Gemini Flash Lite TTS로 만든다(2026-10-29 사용자 결정: 대본 전체를 한 번에 읽어 문장이 자연스럽게 이어진다).
// 키가 없으면 있는 쪽으로, 둘 다 없으면 더미 신호음. Gemini는 기타 관심사의 성인 관련어 검사(topics.ts)와 내 관심 링크 사이트 검사(links.ts)에도 쓴다.
const key = process.env.GEMINI_API_KEY?.trim();
const googleTtsKey = process.env.GOOGLE_TTS_API_KEY?.trim();

// 100만 토큰당 달러(추정치, core/ai/models.ts의 고정 모델 단가). TTS는 2027-01-01부터 두 배
const PRICE = { tts: { input: 0.5, output: 6 }, text: { input: 0.25, output: 1.5 } };

export function logUsage(e: UsageEvent) {
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

/** 음성 엔진. model·voiceId는 음성 캐시 키에 들어가서(episode.ts segmentKey) 엔진을 바꾸면 새로 만든다 */
export interface TtsEngine {
  /** 미리 듣기·안내 음성 파일 이름에도 쓴다(lib/voice-samples.ts) */
  id: 'chirp' | 'gemini';
  model: string;
  /** 실제 목소리 이름(Chirp만). Gemini는 undefined라 캐시 키에서 빠진다 */
  voiceId: (voice: Voice) => string | undefined;
  client: TtsClient;
}

const chirpTts: TtsEngine | null = googleTtsKey
  ? { id: 'chirp', model: 'chirp3-hd', voiceId: chirpVoiceId, client: createGoogleTts({ apiKey: googleTtsKey, onChars: logTtsChars }) }
  : null;
const geminiTts: TtsEngine | null = gemini ? { id: 'gemini', model: GEMINI_MODELS.tts, voiceId: () => undefined, client: gemini } : null;

/** 기본 음성(Free, 그리고 Premium이 Gemini를 못 쓸 때): Chirp 3 HD, 키가 없으면 Gemini, 그것도 없으면 더미 신호음 */
export const basicTts: TtsEngine = chirpTts ?? geminiTts ?? { id: 'gemini', model: GEMINI_MODELS.tts, voiceId: () => undefined, client: ai };
/** Premium 음성: Gemini Flash Lite TTS. Gemini 키가 없으면 기본 음성 */
export const premiumTts: TtsEngine = geminiTts ?? basicTts;

/**
 * Premium Gemini 음성의 하루(KST) 지출 상한(달러). 넘으면 그날은 Premium도 기본 음성으로 만든다(상한 없는 비용을 막는 안전장치).
 * 요약 쪽 상한(파이프라인 GEMINI_DAILY_USD_CAP)과는 따로 센다: 음성이 많이 나가도 소식 요약이 멈추지 않게
 */
const TTS_DAILY_USD_CAP = Number(process.env.GEMINI_TTS_DAILY_USD_CAP) || 2;
let ttsSpend: { at: number; usd: number } | null = null;

async function geminiTtsSpentToday(): Promise<number> {
  if (ttsSpend && Date.now() - ttsSpend.at < 60_000) return ttsSpend.usd;
  const { data, error } = await db.from('usage_log').select('est_usd').eq('provider', 'gemini').eq('kind', 'tts').gte('at', `${kstDate()}T00:00:00+09:00`);
  if (error) {
    console.error('usage_log tts today', error.message);
    return 0;
  }
  ttsSpend = { at: Date.now(), usd: (data as { est_usd: number | string }[]).reduce((n, r) => n + Number(r.est_usd), 0) };
  return ttsSpend.usd;
}

/** 이 사람의 음성을 만들 엔진: 음성 듣기 플랜(Premium)이면 Gemini(오늘 상한 안에서), 아니면 기본 음성 */
export async function ttsEngineFor(audioPlan: boolean): Promise<TtsEngine> {
  if (!audioPlan || premiumTts === basicTts) return basicTts;
  return (await geminiTtsSpentToday()) < TTS_DAILY_USD_CAP ? premiumTts : basicTts;
}

export const screener: Pick<AiClient, 'provider' | 'screenInterest' | 'screenSite'> = gemini ?? ai;

/** 관심사·내 관심 링크 검사 모델(고정 버전) */
export function screenModel(): string {
  return GEMINI_MODELS.screen;
}

