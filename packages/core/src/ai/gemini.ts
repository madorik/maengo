import { GoogleGenAI, MediaResolution, Modality, ThinkingLevel, type Part, type SpeechConfig } from '@google/genai';
import { CATEGORY_IDS, isCategory, type CategoryId } from '../categories';
import { parseWav } from '../audio/wav';
import { templateScript } from './script';
import { CLASSIFY_SYSTEM, MAP_TOPICS_SYSTEM, SCREEN_INTEREST_SYSTEM, SUMMARIZE_SYSTEM, WHY_SYSTEM } from './prompts';
import type {
  AiClient, ClassifyInput, MapTopicsInput, ScreenInterestInput, SpeakInput, SpeakOutput, SummarizeInput, SummarizeOutput, UsageEvent, UsageKind, WhyInput,
} from './types';

// Gemini API(AI Studio 키) 구현. 파이프라인은 summarize·embed를, 웹은 speak(듣기)를 쓴다.
// 듣기 대본은 LLM 없이 템플릿(script.ts)으로 만들고, 음성만 Gemini TTS로 만든다.

export { PROMPT_VERSION } from './prompts';

export const EMBED_DIMENSIONS = 768;

/** TTS 목소리(Gemini 기본 목소리 이름). 대담은 진행자 = 여성, 해설자 = 남성 */
const TTS_VOICES = { f: 'Kore', m: 'Charon' } as const;

/**
 * TTS에 보낼 글. 대본 줄만 그대로 보낸다(말투 지시문을 앞에 붙이면 그 문장까지 소리로 읽는 경우가 있었다, 2026-10-10).
 * 대담은 '진행자: …' / '해설자: …' 줄로 두 목소리를 나눈다.
 */
export function ttsText(lines: { who?: string; text: string }[], pair: boolean): string {
  return lines.map((l) => (pair ? `${l.who ?? '해설자'}: ${l.text}` : l.text)).join('\n');
}

/**
 * TTS는 줄별 시각을 주지 않는다. 전체 길이를 글자 수(+줄 사이 쉼)에 비례해 나눠 대본 하이라이트에 쓴다.
 * 문단 단위 표시에는 충분히 맞고, 문장 단위로는 조금 어긋날 수 있다.
 */
function spreadLines(lines: { text: string }[], durationMs: number): { startMs: number; endMs: number }[] {
  const PAUSE = 6; // 줄 사이 쉼을 글자 6개 정도로 본다
  const total = lines.reduce((n, l) => n + l.text.length + PAUSE, 0) || 1;
  let at = 0;
  return lines.map((l) => {
    const startMs = Math.round((at / total) * durationMs);
    at += l.text.length;
    const endMs = Math.round((at / total) * durationMs);
    at += PAUSE;
    return { startMs, endMs };
  });
}

/** 하루 할당량이 없거나 다 썼다. 같은 실행 안에서 다시 불러도 소용없다(무료 등급의 Pro 모델은 할당량이 0) */
export class GeminiQuotaError extends Error {
  /** Gemini가 알려 준 다시 시도할 때까지 남은 시간(ms). 모르면 null */
  constructor(readonly model: string, message: string, readonly retryMs: number | null = null) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

export interface GeminiOptions {
  apiKey: string;
  /** 503(혼잡)이 계속되면 이 모델로 한 번 더 시도한다 */
  fallbackModel?: string;
  embedModel?: string;
  onUsage?: (e: UsageEvent) => void;
  log?: (msg: string) => void;
  maxAttempts?: number;
}

export interface GeminiAi extends AiClient {
  summarize(input: SummarizeInput): Promise<SummarizeOutput & { model: string }>;
  /** 정규화한 768차원 벡터. 순서는 입력과 같다 */
  embed(texts: string[]): Promise<number[][]>;
}

interface ApiErrorShape {
  status?: number;
  message?: string;
}

function parseError(e: unknown): { status: number; daily: boolean; retryMs: number | null; text: string } {
  const err = e as ApiErrorShape;
  const status = typeof err?.status === 'number' ? err.status : 0;
  const text = String(err?.message ?? e);
  let daily = false;
  let retryMs: number | null = null;
  try {
    const body = JSON.parse(text) as { error?: { details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] } };
    for (const d of body.error?.details ?? []) {
      if (d['@type']?.endsWith('RetryInfo') && d.retryDelay) retryMs = Math.ceil(parseFloat(d.retryDelay) * 1000);
      if (d['@type']?.endsWith('QuotaFailure')) daily ||= (d.violations ?? []).some((v) => /PerDay/.test(v.quotaId ?? ''));
    }
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 본다
  }
  if (/limit: 0\b/.test(text)) daily = true;
  return { status, daily, retryMs, text };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

const str = { type: 'string' } as const;

function summarizeSchema(topicIds: string[], video: boolean) {
  return {
    type: 'object',
    properties: {
      skip: str,
      title: str,
      short: str,
      body: { type: 'array', items: str },
      category: { type: 'string', enum: CATEGORY_IDS },
      author: str,
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string', enum: topicIds }, relevance: { type: 'number' } },
          required: ['id', 'relevance'],
        },
      },
      why: {
        type: 'array',
        items: {
          type: 'object',
          properties: { topicId: { type: 'string', enum: topicIds }, text: str },
          required: ['topicId', 'text'],
        },
      },
      ...(video
        ? { scenes: { type: 'array', items: { type: 'object', properties: { t: str, label: str }, required: ['t', 'label'] } } }
        : {}),
    },
    required: ['skip', 'title', 'short', 'body', 'category', 'author', 'topics', 'why'],
  };
}

function sourceBlock(input: SummarizeInput): string {
  return input.sources
    .map((s, i) =>
      [
        `[글 ${i + 1}] ${s.title}`,
        `출처: ${s.sourceName}${s.author ? ` / 글쓴이: ${s.author}` : ''}${s.publishedAt ? ` / 작성: ${s.publishedAt}` : ''}`,
        `주소: ${s.url}`,
        s.text ? `본문:\n${s.text}` : '본문: (없음)',
      ].join('\n'),
    )
    .join('\n\n');
}

function dictionaryBlock(input: SummarizeInput): string {
  return input.dictionary.map((t) => `- ${t.id}: ${t.name}${t.aliases.length ? ` (${t.aliases.join(', ')})` : ''}`).join('\n');
}

export function createGeminiAi(opts: GeminiOptions): GeminiAi {
  const client = new GoogleGenAI({ apiKey: opts.apiKey });
  const maxAttempts = opts.maxAttempts ?? 5;
  const embedModel = opts.embedModel ?? 'gemini-embedding-001';
  const log = opts.log ?? (() => {});

  /** 재시도: 429는 서버가 알려 준 만큼 기다리고, 5xx는 지수 백오프. 하루 할당량이 없으면 바로 GeminiQuotaError */
  async function withRetry<T>(model: string, call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await call();
      } catch (e) {
        const { status, daily, retryMs, text } = parseError(e);
        if (status === 429 && daily) throw new GeminiQuotaError(model, text.slice(0, 300), retryMs);
        const retryable = status === 429 || status === 500 || status === 503 || status === 504;
        if (!retryable || attempt >= maxAttempts) throw e;
        const wait = status === 429 ? Math.min(retryMs ?? 15_000, 65_000) : Math.min(2000 * 2 ** (attempt - 1), 30_000);
        log(`gemini ${model} ${status} → ${Math.round(wait / 1000)}초 뒤 다시 (${attempt}/${maxAttempts})`);
        await sleep(wait + Math.floor(Math.random() * 500));
      }
    }
  }

  async function generateJson<T>(args: {
    model: string;
    kind: UsageKind;
    system: string;
    parts: Part[];
    schema: unknown;
    thinking: ThinkingLevel;
    video?: boolean;
  }): Promise<{ data: T; model: string }> {
    const run = async (model: string) => {
      const res = await withRetry(model, () =>
        client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: args.parts }],
          config: {
            systemInstruction: args.system,
            responseMimeType: 'application/json',
            responseJsonSchema: args.schema,
            thinkingConfig: { thinkingLevel: args.thinking },
            ...(args.video ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
          },
        }),
      );
      const u = res.usageMetadata;
      opts.onUsage?.({
        model: res.modelVersion ?? model,
        kind: args.kind,
        inputTokens: u?.promptTokenCount ?? 0,
        outputTokens: u?.candidatesTokenCount ?? 0,
        thinkingTokens: u?.thoughtsTokenCount ?? 0,
      });
      const text = res.text;
      if (!text) throw new Error(`빈 응답(${res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'unknown'})`);
      return { data: JSON.parse(text) as T, model: res.modelVersion ?? model };
    };
    try {
      return await run(args.model);
    } catch (e) {
      const { status } = parseError(e);
      if (opts.fallbackModel && opts.fallbackModel !== args.model && (status === 503 || status === 500)) {
        log(`gemini ${args.model} 혼잡 → ${opts.fallbackModel}로 대신`);
        return run(opts.fallbackModel);
      }
      throw e;
    }
  }

  return {
    provider: 'gemini',

    async summarize(input) {
      const topicIds = input.dictionary.map((t) => t.id);
      const video = input.kind === 'video' && !!input.videoUrl;
      const parts: Part[] = [];
      if (video) parts.push({ fileData: { fileUri: input.videoUrl!, mimeType: 'video/*' } });
      parts.push({ text: `토픽 사전\n${dictionaryBlock(input)}\n\n${sourceBlock(input)}` });
      const { data, model } = await generateJson<{
        skip: string; title: string; short: string; body: string[]; category: string; author: string;
        topics: { id: string; relevance: number }[]; why: { topicId: string; text: string }[];
        scenes?: { t: string; label: string }[];
      }>({
        model: input.model,
        kind: video ? 'video' : 'summary',
        system: SUMMARIZE_SYSTEM,
        parts,
        schema: summarizeSchema(topicIds, video),
        thinking: ThinkingLevel.LOW,
        video,
      });
      const known = new Set(topicIds);
      const topics = (data.topics ?? [])
        .filter((t) => known.has(t.id))
        .map((t) => ({ topicId: t.id, relevance: Math.min(1, Math.max(0, Number(t.relevance) || 0)) }))
        .slice(0, 3);
      const picked = new Set(topics.map((t) => t.topicId));
      return {
        model,
        skip: data.skip?.trim() ? data.skip.trim() : null,
        title: data.title?.trim() ?? '',
        short: data.short?.trim() ?? '',
        body: (data.body ?? []).map((p) => p.trim()).filter(Boolean),
        category: isCategory(data.category) ? data.category : 'etc',
        author: data.author?.trim() ?? '',
        topics,
        why: (data.why ?? []).filter((w) => picked.has(w.topicId) && w.text?.trim()).map((w) => ({ topicId: w.topicId, text: w.text.trim() })),
        scenes: video ? (data.scenes ?? []).filter((s) => s.t && s.label) : undefined,
      };
    },

    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 100) {
        const batch = texts.slice(i, i + 100);
        const res = await withRetry(embedModel, () =>
          client.models.embedContent({ model: embedModel, contents: batch, config: { outputDimensionality: EMBED_DIMENSIONS } }),
        );
        const vectors = res.embeddings ?? [];
        if (vectors.length !== batch.length) throw new Error(`임베딩 개수가 맞지 않아요(${vectors.length}/${batch.length})`);
        for (const v of vectors) out.push(normalize(v.values ?? []));
        opts.onUsage?.({ model: embedModel, kind: 'embed', inputTokens: batch.reduce((n, t) => n + Math.ceil(t.length / 3), 0), outputTokens: 0, thinkingTokens: 0 });
      }
      return out;
    },

    async why(input: WhyInput) {
      const { data } = await generateJson<{ text: string }>({
        model: input.model,
        kind: 'why',
        system: WHY_SYSTEM,
        parts: [{ text: `토픽: ${input.topicName}\n\n제목: ${input.title}\n요약: ${input.short}\n본문:\n${input.body.join('\n')}` }],
        schema: { type: 'object', properties: { text: str }, required: ['text'] },
        thinking: ThinkingLevel.LOW,
      });
      return `${input.lead}: ${data.text.trim()}`;
    },

    async classify(input: ClassifyInput): Promise<CategoryId> {
      const { data } = await generateJson<{ category: string }>({
        model: input.model,
        kind: 'classify',
        system: CLASSIFY_SYSTEM,
        parts: [{ text: `제목: ${input.title}\n요약: ${input.short}\n본문:\n${input.body.join('\n').slice(0, 4000)}` }],
        schema: { type: 'object', properties: { category: { type: 'string', enum: CATEGORY_IDS } }, required: ['category'] },
        thinking: ThinkingLevel.MINIMAL,
      });
      return isCategory(data.category) ? data.category : 'etc';
    },

    async mapTopics(input: MapTopicsInput) {
      const ids = input.dictionary.map((t) => t.id);
      const { data } = await generateJson<{ ids: string[] }>({
        model: input.model,
        kind: 'topic_map',
        system: MAP_TOPICS_SYSTEM,
        parts: [{ text: `토픽 사전\n${input.dictionary.map((t) => `- ${t.id}: ${t.name} (${t.aliases.join(', ')})`).join('\n')}\n\n관심사 문장: ${input.text}` }],
        schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', enum: ids } } }, required: ['ids'] },
        thinking: ThinkingLevel.MINIMAL,
      });
      const known = new Set(ids);
      return [...new Set((data.ids ?? []).filter((id) => known.has(id)))].slice(0, 3);
    },

    async screenInterest(input: ScreenInterestInput) {
      // 화면에서 기다리는 검사라 재시도·대체 모델 없이 한 번만 짧게 묻는다
      const res = await client.models.generateContent({
        model: input.model,
        contents: [{ role: 'user', parts: [{ text: input.phrases.map((p, i) => `${i + 1}. ${p}`).join('\n') }] }],
        config: {
          systemInstruction: SCREEN_INTEREST_SYSTEM,
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object', properties: { adult: { type: 'boolean' } }, required: ['adult'] },
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          abortSignal: AbortSignal.timeout(input.timeoutMs ?? 6000),
        },
      });
      const u = res.usageMetadata;
      opts.onUsage?.({ model: res.modelVersion ?? input.model, kind: 'screen', inputTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0, thinkingTokens: u?.thoughtsTokenCount ?? 0 });
      // Gemini 안전 필터가 질문이나 답을 막았으면 성인 관련어로 본다
      const finish = res.candidates?.[0]?.finishReason;
      if (res.promptFeedback?.blockReason || finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') return { adult: true };
      const text = res.text;
      if (!text) throw new Error(`빈 응답(${finish ?? 'unknown'})`);
      return { adult: (JSON.parse(text) as { adult?: unknown }).adult === true };
    },

    async script(input) {
      return templateScript(input);
    },

    async speak(input: SpeakInput): Promise<SpeakOutput> {
      const voice = input.voice;
      const pair = voice === 'pair';
      const speechConfig: SpeechConfig = pair
        ? {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: '진행자', voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICES.f } } },
                { speaker: '해설자', voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICES.m } } },
              ],
            },
          }
        : { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICES[voice] } } };
      const res = await withRetry(input.model, () =>
        client.models.generateContent({
          model: input.model,
          contents: [{ role: 'user', parts: [{ text: ttsText(input.lines, pair) }] }],
          config: { responseModalities: [Modality.AUDIO], speechConfig },
        }),
      );
      const u = res.usageMetadata;
      opts.onUsage?.({ model: res.modelVersion ?? input.model, kind: 'tts', inputTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0, thinkingTokens: 0 });
      const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!data?.data) throw new Error(`음성이 비어 있어요(${res.candidates?.[0]?.finishReason ?? 'unknown'})`);
      const bytes = new Uint8Array(Buffer.from(data.data, 'base64'));
      // audio/wav(헤더 포함) 또는 audio/L16;rate=24000(raw PCM)으로 온다
      const wav = parseWav(bytes);
      const pcm = wav?.pcm ?? bytes;
      const sampleRate = wav?.sampleRate ?? Number(data.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
      const bitsPerSample = wav?.bitsPerSample ?? 16;
      const durationMs = Math.round((pcm.length / (sampleRate * (bitsPerSample / 8))) * 1000);
      return { pcm, sampleRate, bitsPerSample, durationMs, lineTimesMs: spreadLines(input.lines, durationMs) };
    },
  };
}
