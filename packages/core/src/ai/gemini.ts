import { GoogleGenAI, MediaResolution, Modality, ThinkingLevel, type GenerateContentResponse, type Part, type SpeechConfig } from '@google/genai';
import { CATEGORY_IDS, isCategory, type CategoryId } from '../categories';
import { IMPACTS, isImpact } from '../feed/impact';
import { alignLines } from '../audio/align';
import { estimateTimeline } from '../audio/personas';
import { parseWav, trimSilence } from '../audio/wav';
import { GEMINI_MODELS } from './models';
import { templateScript } from './script';
import { CLASSIFY_SYSTEM, MAP_TOPICS_SYSTEM, SCREEN_INTEREST_SYSTEM, SCREEN_SITE_SYSTEM, SUMMARIZE_SYSTEM, WHY_SYSTEM } from './prompts';
import type {
  AiClient, ClassifyInput, MapTopicsInput, ScreenInterestInput, ScreenSiteInput, SiteVerdict, SpeakInput, SpeakOutput, SummarizeInput, SummarizeOutput, UsageEvent, UsageKind, WhyInput,
} from './types';
import { SITE_VERDICTS } from './types';

// Gemini API(AI Studio 키) 구현. 파이프라인은 summarize·embed를, 웹은 speak(듣기)를 쓴다.
// 듣기 대본은 LLM 없이 템플릿(script.ts)으로 만들고, 음성만 Gemini TTS로 만든다.

export { PROMPT_VERSION } from './prompts';

export const EMBED_DIMENSIONS = 768;

/**
 * 요약 글이 한국어인지. 제품·회사 이름은 원어로 쓰니 영문 글자가 섞여도 되고, 글자 중 한글이 20% 미만이면 영어 요약으로 본다.
 * (2026-10-23 운영 요약 163개는 모두 통과, 영어로 쓴 요약은 한글이 거의 0이다)
 */
export function isKoreanSummary(text: string): boolean {
  const hangul = text.match(/[가-힣]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return hangul > 0 && hangul >= (hangul + latin) * 0.2;
}

/**
 * TTS 목소리(Gemini). name은 기본 목소리 이름이나 목소리 라이브러리 id, style은 말투 지시(소리로 읽지 않는다),
 * languageCode는 읽을 언어 고정(영어 목소리가 한국어 대본을 영어로 읽거나 지어내지 않게). 사용자 확정:
 * - 여성(2026-10-30): 라이브러리 ko-kr-podcaster-6(31세 서울 기자, 높은 톤) + 젊은 기상캐스터 말투. 후보 3개 중 고름.
 *   전에 쓰던 Fola(en-us-fola, 37세)는 나이 들어 들린다고 바꿈
 * - 남성(2026-11-04): 라이브러리 ko-kr-podcaster-8(35세 서울 기자) + 35세 저녁 뉴스 앵커 말투(차분·중립, 문장 끝을 끌지 않음). 후보 3개 중 고름.
 *   전에 쓰던 ko-kr-podcaster-9(41세 라디오 진행자)는 느끼하다고 바꿈
 * 한국어 목소리는 'ko'를 주면 거절한다(No matching speaker voice ... language: ko)라 고정하지 않는다
 * 목소리·말투를 바꾸면 음성 캐시 키도 바뀐다(apps/web lib/server/ai.ts geminiVoiceId)
 */
export const GEMINI_TTS_VOICES: Record<'f' | 'm', { name: string; style?: string; languageCode?: string }> = {
  f: {
    name: 'ko-kr-podcaster-6',
    style: 'Young Korean TV weather forecaster in her mid-20s: bright, clear and friendly, a light smile in the voice, crisp diction, steady upbeat pace.',
  },
  m: {
    name: 'ko-kr-podcaster-8',
    style:
      '35-year-old Korean male TV news anchor reading the evening news: calm, neutral and credible. Plain, even delivery with crisp articulation and a steady medium pace. No smile in the voice, no breathiness, no drawn-out or sing-song sentence endings; finish each sentence cleanly and firmly.',
  },
};

/**
 * TTS에 보낼 글: 대본 줄 그대로. 말투는 글에 섞지 않고 Part.speechMetadata.style로 따로 보낸다(speak).
 * 대본 앞에 붙이면 예전 모델은 지시문까지 소리로 읽었고(2026-10-10), 3.8에 AI Studio처럼 '# Director's note'로 붙였더니
 * 짧은 대본에서 대본을 버리고 영어로 '아침 인사'를 27초 지어냈다(2026-10-29)
 */
export function ttsText(lines: { text: string }[]): string {
  return lines.map((l) => l.text).join('\n');
}

/**
 * 만든 음성이 대본에 비해 너무 길거나 짧으면 대본대로 읽지 않은 것으로 본다(지어낸 말·중간에 끊김). 대본 길이로 어림한 시간의
 * 이 배수 밖이면 오류로 던져 부르는 쪽이 다른 음성으로 만들게 한다(apps/web episode.ts: Premium은 기본 음성으로)
 */
const TTS_LENGTH_RANGE = { min: 0.3, max: 2.5, slackMs: 8_000 };

/*
 * 듣기 음성은 문단마다 따로 만들어 동시에 받고 이어 붙인다(2026-11-06). 대본 전체를 한 번에 보내면 85초짜리 음성에 12초쯤 걸렸는데
 * 문단 4개를 동시에 보내니 5초쯤(같은 소식 #20320으로 비교, 사용자가 들어 보고 고름). 문단 사이 쉼은 Chirp와 같게 둔다(apps/web google-tts.ts)
 */
/** 문단 사이 쉼 */
const TTS_PARA_GAP_MS = 380;
/** 이어 붙일 때 문단 음성 앞뒤에 남기는 무음(말끝이 잘리지 않게) */
const TTS_EDGE_KEEP_MS = 60;
/** 한 소식에서 동시에 부르는 수. 소식 하나가 보통 문단 3~5개라 한 번에 다 간다 */
const TTS_PARALLEL = 6;

/**
 * 대본 줄을 문단별로 묶는다(줄 번호). 제목·마무리처럼 문단 번호가 없는 줄은 혼자 보내지 않고 앞 문단에(맨 앞이면 첫 문단에) 붙인다.
 * 짧은 글만 따로 보내면 대본을 버리고 지어낼 수 있어서다(2026-10-29 '아침 인사' 27초)
 */
export function ttsRuns(lines: { para?: number }[]): number[][] {
  const runs: number[][] = [];
  let para: number | undefined;
  lines.forEach((line, i) => {
    const run = runs.at(-1);
    if (run && (line.para === undefined || para === undefined || line.para === para)) run.push(i);
    else runs.push([i]);
    if (line.para !== undefined) para = line.para;
  });
  return runs;
}

/** 하루 할당량이 없거나 다 썼다. 같은 실행 안에서 다시 불러도 소용없다(무료 등급의 Pro 모델은 할당량이 0) */
export class GeminiQuotaError extends Error {
  /** Gemini가 알려 준 다시 시도할 때까지 남은 시간(ms). 모르면 null */
  constructor(readonly model: string, message: string, readonly retryMs: number | null = null) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

/**
 * 돈 때문에 막혔다: 선불 크레딧 소진(402, credits) 또는 우리가 정한 하루 지출 상한(budget).
 * 할당량 오류의 한 갈래라 GeminiQuotaError로 잡던 곳(요약 반복 멈춤 등)이 그대로 멈춘다.
 */
export class GeminiBlockedError extends GeminiQuotaError {
  constructor(model: string, message: string, readonly reason: 'credits' | 'budget') {
    super(model, message, null);
    this.name = 'GeminiBlockedError';
  }
}

/**
 * 돈을 내고 받은 응답을 쓸 수 없다: 빈 응답(안전 필터·출력 토큰 한도 등) 또는 JSON이 깨진 응답.
 * 같은 입력으로 다시 불러도 대개 같아서, 부르는 쪽이 묶음마다 실패를 세어 몇 번 뒤엔 건너뛴다(pipeline summarize)
 */
export class GeminiOutputError extends Error {
  constructor(readonly model: string, message: string) {
    super(message);
    this.name = 'GeminiOutputError';
  }
}

/**
 * 마감(deadline)이 있는 실행(1분 배송·스케줄러)에서 요청 한 번에 응답을 기다리는 최대 시간(ms). 넘으면 끊고 GeminiTimeoutError(504로 보고 다시 시도 규칙을 따른다).
 * 전엔 제한이 없어 마감 직전에 시작한 요청이 300초 서버 함수를 넘겨 실행이 통째로 끊길 수 있었다(2026-10-18 점검).
 * 마감이 없는 호출(화면의 오늘 소식 받기·음성·링크)은 끊지 않는다: 오래 걸려도 끝까지 받는 게 낫다(끊고 다시 부르면 그만큼 돈이 든다)
 */
export const GEMINI_TIMEOUT_MS = 60_000;
/** 영상 요약은 영상을 읽느라 더 걸린다 */
export const GEMINI_VIDEO_TIMEOUT_MS = 180_000;
/** 영상 요약 때 화면을 보는 빈도(1초에 몇 장). 0.1 = 10초에 한 장(내 관심 링크 유튜브 채널, 2026-11-08) */
export const VIDEO_FPS = 0.1;
/** 듣기 음성(TTS)은 글이 길어 더 기다린다 */
export const GEMINI_TTS_TIMEOUT_MS = 120_000;
/** 마감(deadline)까지 이보다 적게 남았으면 부르지 않는다(끊길 게 뻔한 요청에 돈을 쓰지 않게) */
export const GEMINI_MIN_REQUEST_MS = 5_000;

export interface GeminiOptions {
  apiKey: string;
  /** 503(혼잡)이 계속되면 이 모델로 한 번 더 시도한다 */
  fallbackModel?: string;
  embedModel?: string;
  onUsage?: (e: UsageEvent) => void;
  log?: (msg: string) => void;
  maxAttempts?: number;
  /** 이 시각(ms)을 넘겨 기다려야 하면 다시 시도하지 않고 바로 실패한다(서버 함수 시간 제한 안에서 끝내려고, 1분 배송) */
  retryUntil?: number;
  /** 요청 한 번에 응답을 기다리는 최대 시간(ms). 없으면 마감이 있을 때만 GEMINI_TIMEOUT_MS(영상·음성은 더 길게), 마감도 없으면 끊지 않는다 */
  timeoutMs?: number;
  /**
   * 이 시각(ms)까지는 응답을 받아야 한다(서버 함수 시간 제한). 요청마다 남은 시간만큼만 기다리고(기본 제한과 둘 중 짧은 것),
   * GEMINI_MIN_REQUEST_MS도 안 남았으면 부르지 않고 GeminiTimeoutError
   */
  deadline?: number;
}

/** 요청이 시간 안에 끝나지 않았다(또는 마감이 가까워 부르지 않았다). 상태는 504로 보고 다시 시도 규칙을 따른다 */
export class GeminiTimeoutError extends Error {
  readonly status = 504;
  constructor(readonly model: string, readonly timeoutMs: number) {
    super(timeoutMs > 0 ? `Gemini ${model} 응답이 ${Math.round(timeoutMs / 1000)}초 안에 오지 않아 끊음` : `Gemini ${model}: 마감이 가까워 부르지 않음`);
    this.name = 'GeminiTimeoutError';
  }
}

/**
 * 이번 요청을 기다릴 시간(ms): 제한과 마감까지 남은 시간 중 짧은 것. 제한도 마감도 없으면 Infinity(끊지 않는다).
 * 마감까지 GEMINI_MIN_REQUEST_MS도 안 남았으면 null(부르지 않는다)
 */
export function requestTimeoutMs(limitMs: number | null, now: number, deadline?: number): number | null {
  if (deadline === undefined) return limitMs ?? Infinity;
  const left = deadline - now;
  return left < GEMINI_MIN_REQUEST_MS ? null : Math.min(limitMs ?? Infinity, left);
}

/**
 * call을 ms 안에 끝낸다. 넘으면 신호(signal)로 요청을 끊고 GeminiTimeoutError.
 * SDK가 신호를 늦게 따르더라도 기다리지 않게 시간 초과를 따로 겨룬다
 */
export async function callWithTimeout<T>(model: string, ms: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  // 끊지 않는 요청(제한·마감 없음). setTimeout은 2^31-1ms를 넘으면 바로 불리므로 따로 둔다
  if (!Number.isFinite(ms)) return call(ctrl.signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new GeminiTimeoutError(model, ms));
    }, ms);
  });
  try {
    return await Promise.race([call(ctrl.signal), timedOut]);
  } catch (e) {
    // 끊어서 난 오류(AbortError 등)도 시간 초과로 본다
    throw ctrl.signal.aborted && !(e instanceof GeminiTimeoutError) ? new GeminiTimeoutError(model, ms) : e;
  } finally {
    clearTimeout(timer);
  }
}

/** 기다렸다 다시 할 마감: retryUntil과 (deadline - GEMINI_MIN_REQUEST_MS) 중 이른 것. 둘 다 없으면 undefined */
export function retryDeadline(retryUntil?: number, deadline?: number): number | undefined {
  const fromDeadline = deadline === undefined ? undefined : deadline - GEMINI_MIN_REQUEST_MS;
  if (retryUntil === undefined) return fromDeadline;
  return fromDeadline === undefined ? retryUntil : Math.min(retryUntil, fromDeadline);
}

/**
 * 다시 시도하기 전에 기다릴 시간(ms). 다시 하지 않으면 null: 다시 해도 소용없는 오류, 횟수를 다 씀, 기다리면 retryUntil을 넘김.
 * 429는 서버가 알려 준 만큼(최대 65초), 5xx(시간 초과 504 포함)는 지수 백오프(2초부터 최대 30초)
 */
export function retryWaitMs(status: number, retryMs: number | null, attempt: number, maxAttempts: number, now: number, retryUntil?: number): number | null {
  const retryable = status === 429 || status === 500 || status === 503 || status === 504;
  if (!retryable || attempt >= maxAttempts) return null;
  const wait = status === 429 ? Math.min(retryMs ?? 15_000, 65_000) : Math.min(2000 * 2 ** (attempt - 1), 30_000);
  if (retryUntil !== undefined && now + wait > retryUntil) return null;
  return wait;
}

/**
 * 요약의 생각 단계. 생각 토큰은 출력 요금이라 요약 비용의 대부분이 된다.
 * 2026-10-14 같은 기사로 비교: 3.1-flash-lite 낮음 ₩6.7·8.3초, 최소 ₩2.9·3.2초. 내용은 비슷하고 최소는 말투가 섞여서 프롬프트 v7에 '~요'로 끝내기를 넣었다
 */
const SUMMARY_THINKING = ThinkingLevel.MINIMAL;

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
  let status = typeof err?.status === 'number' ? err.status : 0;
  const text = String(err?.message ?? e);
  let daily = false;
  let retryMs: number | null = null;
  try {
    const body = JSON.parse(text) as { error?: { code?: number; details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] } };
    // 상태 코드가 오류 객체에 없으면 본문의 error.code를 쓴다(402 크레딧 소진이 이렇게 온다)
    if (!status && typeof body.error?.code === 'number') status = body.error.code;
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
      impact: { type: 'string', enum: IMPACTS },
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
    required: ['skip', 'title', 'short', 'body', 'category', 'impact', 'author', 'topics', 'why'],
  };
}

function sourceBlock(input: SummarizeInput): string {
  return input.sources
    .map((s, i) => {
      const signals = [
        s.credibility ? `출처 신뢰도: ${s.credibility}` : '',
        s.views != null ? `조회수: ${s.views.toLocaleString('ko-KR')}회` : '',
        s.hnPoints != null ? `해커 뉴스 점수: ${s.hnPoints}` : '',
      ].filter(Boolean);
      return [
        `[글 ${i + 1}] ${s.title}`,
        `출처: ${s.sourceName}${s.author ? ` / 글쓴이: ${s.author}` : ''}${s.publishedAt ? ` / 작성: ${s.publishedAt}` : ''}`,
        ...(signals.length ? [signals.join(' / ')] : []),
        `주소: ${s.url}`,
        s.text ? `본문:\n${s.text}` : '본문: (없음)',
      ].join('\n');
    })
    .join('\n\n');
}

function dictionaryBlock(input: SummarizeInput): string {
  return input.dictionary.map((t) => `- ${t.id}: ${t.name}${t.aliases.length ? ` (${t.aliases.join(', ')})` : ''}`).join('\n');
}

export function createGeminiAi(opts: GeminiOptions): GeminiAi {
  const client = new GoogleGenAI({ apiKey: opts.apiKey });
  const maxAttempts = opts.maxAttempts ?? 5;
  const embedModel = opts.embedModel ?? GEMINI_MODELS.embed;
  const log = opts.log ?? (() => {});
  /** 요청 한 번의 제한: 직접 정한 값, 아니면 마감이 있을 때만 종류별 기본값(마감이 없으면 끊지 않는다) */
  const limitFor = (base: number): number | null => opts.timeoutMs ?? (opts.deadline === undefined ? null : base);

  /**
   * 재시도: 429는 서버가 알려 준 만큼 기다리고, 5xx·시간 초과는 지수 백오프. 하루 할당량이 없으면 바로 GeminiQuotaError, 크레딧이 없으면 GeminiBlockedError.
   * 요청마다 limitMs(마감이 있으면 남은 시간까지) 안에 끝나지 않으면 끊는다
   */
  async function withRetry<T>(model: string, call: (signal: AbortSignal) => Promise<T>, limitMs = limitFor(GEMINI_TIMEOUT_MS)): Promise<T> {
    // 마감이 있으면 기다렸다 다시 할 때도 그 뒤에 요청 하나 할 시간은 남긴다
    const retryUntil = retryDeadline(opts.retryUntil, opts.deadline);
    for (let attempt = 1; ; attempt++) {
      const ms = requestTimeoutMs(limitMs, Date.now(), opts.deadline);
      if (ms === null) throw new GeminiTimeoutError(model, 0);
      try {
        return await callWithTimeout(model, ms, call);
      } catch (e) {
        const { status, daily, retryMs, text } = parseError(e);
        if (status === 429 && daily) throw new GeminiQuotaError(model, text.slice(0, 300), retryMs);
        // 402: 선불 크레딧이 바닥났다. 다시 불러도 소용없다
        if (status === 402) throw new GeminiBlockedError(model, text.slice(0, 300), 'credits');
        const wait = retryWaitMs(status, retryMs, attempt, maxAttempts, Date.now(), retryUntil);
        if (wait === null) throw e;
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
      const res = await withRetry(
        model,
        (abortSignal) =>
          client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: args.parts }],
            config: {
              systemInstruction: args.system,
              responseMimeType: 'application/json',
              responseJsonSchema: args.schema,
              thinkingConfig: { thinkingLevel: args.thinking },
              ...(args.video ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
              abortSignal,
            },
          }),
        limitFor(args.video ? GEMINI_VIDEO_TIMEOUT_MS : GEMINI_TIMEOUT_MS),
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
      const finish = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'unknown';
      if (!text) throw new GeminiOutputError(model, `빈 응답(${finish})`);
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        throw new GeminiOutputError(model, `JSON이 아닌 응답(${finish}): ${text.slice(0, 80)}`);
      }
      return { data, model: res.modelVersion ?? model };
    };
    try {
      return await run(args.model);
    } catch (e) {
      const { status } = parseError(e);
      const until = retryDeadline(opts.retryUntil, opts.deadline);
      const late = until !== undefined && Date.now() > until;
      if (opts.fallbackModel && opts.fallbackModel !== args.model && (status === 503 || status === 500) && !late) {
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
      // 화면은 10초에 한 장만 본다(말하는 영상은 소리가 핵심, 2026-11-08 실측 20분 영상 약 3.8만 토큰). 저해상도는 generateJson에서
      if (video) parts.push({ fileData: { fileUri: input.videoUrl!, mimeType: 'video/*' }, videoMetadata: { fps: VIDEO_FPS } });
      parts.push({ text: `토픽 사전\n${dictionaryBlock(input)}\n\n${sourceBlock(input)}` });
      const { data, model } = await generateJson<{
        skip: string; title: string; short: string; body: string[]; category: string; impact: string; author: string;
        topics: { id: string; relevance: number }[]; why: { topicId: string; text: string }[];
        scenes?: { t: string; label: string }[];
      }>({
        model: input.model,
        kind: video ? 'video' : 'summary',
        system: SUMMARIZE_SYSTEM,
        parts,
        schema: summarizeSchema(topicIds, video),
        thinking: SUMMARY_THINKING,
        video,
      });
      const known = new Set(topicIds);
      const topics = (data.topics ?? [])
        .filter((t) => known.has(t.id))
        .map((t) => ({ topicId: t.id, relevance: Math.min(1, Math.max(0, Number(t.relevance) || 0)) }))
        .slice(0, 3);
      const picked = new Set(topics.map((t) => t.topicId));
      const skip = data.skip?.trim() ? data.skip.trim() : null;
      // 영문 글을 요약하다 영어로 답하면 저장하지 않는다(요약 실패로 세어 다시 시도된다)
      if (!skip && !isKoreanSummary([data.title ?? '', data.short ?? '', ...(data.body ?? [])].join(' '))) {
        throw new GeminiOutputError(model, `한국어가 아닌 요약: ${(data.title ?? '').slice(0, 60)}`);
      }
      return {
        model,
        skip,
        title: data.title?.trim() ?? '',
        short: data.short?.trim() ?? '',
        body: (data.body ?? []).map((p) => p.trim()).filter(Boolean),
        category: isCategory(data.category) ? data.category : 'etc',
        impact: isImpact(data.impact) ? data.impact : null,
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
        const res = await withRetry(embedModel, (abortSignal) =>
          client.models.embedContent({ model: embedModel, contents: batch, config: { outputDimensionality: EMBED_DIMENSIONS, abortSignal } }),
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

    async screenSite(input: ScreenSiteInput) {
      // screenInterest와 같이 화면에서 기다리는 검사라 한 번만 짧게 묻는다
      const posts = input.posts.map((p, i) => `${i + 1}. ${p.title}${p.excerpt ? ` — ${p.excerpt.slice(0, 120)}` : ''}`).join('\n');
      const res = await client.models.generateContent({
        model: input.model,
        contents: [{ role: 'user', parts: [{ text: `이름: ${input.name}\n주소: ${input.host}\n최근 글:\n${posts}` }] }],
        config: {
          systemInstruction: SCREEN_SITE_SYSTEM,
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object', properties: { verdict: { type: 'string', enum: [...SITE_VERDICTS] } }, required: ['verdict'] },
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          abortSignal: AbortSignal.timeout(input.timeoutMs ?? 6000),
        },
      });
      const u = res.usageMetadata;
      opts.onUsage?.({ model: res.modelVersion ?? input.model, kind: 'screen', inputTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0, thinkingTokens: u?.thoughtsTokenCount ?? 0 });
      // Gemini 안전 필터가 질문이나 답을 막았으면 성인 사이트로 본다
      const finish = res.candidates?.[0]?.finishReason;
      if (res.promptFeedback?.blockReason || finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') return { verdict: 'adult' as const };
      const text = res.text;
      if (!text) throw new Error(`빈 응답(${finish ?? 'unknown'})`);
      const verdict = (JSON.parse(text) as { verdict?: unknown }).verdict;
      return { verdict: SITE_VERDICTS.includes(verdict as SiteVerdict) ? (verdict as SiteVerdict) : 'ok' };
    },

    async script(input) {
      return templateScript(input);
    },

    async speak(input: SpeakInput): Promise<SpeakOutput> {
      const voice = GEMINI_TTS_VOICES[input.voice];
      const speechConfig: SpeechConfig = { ...(voice.languageCode ? { languageCode: voice.languageCode } : {}), voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.name } } };
      /** 줄 묶음 하나를 음성(16비트 PCM)으로. 대본보다 너무 길거나 짧으면 대본대로 읽지 않은 것으로 보고 던진다 */
      const speakRun = async (lines: SpeakInput['lines']) => {
        const res = await withRetry(
          input.model,
          (abortSignal) =>
            client.models.generateContent({
              model: input.model,
              contents: [{ role: 'user', parts: [{ text: ttsText(lines), ...(voice.style ? { speechMetadata: { style: voice.style } } : {}) }] }],
              config: { responseModalities: [Modality.AUDIO], speechConfig, abortSignal },
            }),
          limitFor(GEMINI_TTS_TIMEOUT_MS),
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
        if ((wav?.bitsPerSample ?? 16) !== 16) throw new Error('Gemini 음성이 16비트 PCM이 아니에요');
        const durationMs = Math.round((pcm.length / (sampleRate * 2)) * 1000);
        const expectedMs = estimateTimeline(lines).durationMs;
        if (durationMs > expectedMs * TTS_LENGTH_RANGE.max + TTS_LENGTH_RANGE.slackMs || durationMs < expectedMs * TTS_LENGTH_RANGE.min) {
          throw new Error(`음성 길이가 대본과 맞지 않아요(${Math.round(durationMs / 1000)}초, 어림 ${Math.round(expectedMs / 1000)}초)`);
        }
        return { pcm, sampleRate };
      };

      const runs = ttsRuns(input.lines);
      const parts: { pcm: Uint8Array; sampleRate: number }[] = new Array(runs.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(TTS_PARALLEL, runs.length) }, async () => {
          while (next < runs.length) {
            const r = next++;
            parts[r] = await speakRun(runs[r]!.map((i) => input.lines[i]!));
          }
        }),
      );
      const sampleRate = parts[0]!.sampleRate;
      if (parts.some((p) => p.sampleRate !== sampleRate)) throw new Error('문단 음성의 샘플레이트가 서로 달라요');

      // 문단 앞뒤 무음을 걷어 내고 정한 쉼을 넣어 이어 붙인다(묶음이 하나면 그대로). 줄 시각은 묶음마다 쉼으로 찾아 그 묶음 시작만큼 민다
      const bytesPerMs = (sampleRate * 2) / 1000;
      const gap = new Uint8Array(Math.round((TTS_PARA_GAP_MS * bytesPerMs) / 2) * 2);
      const pieces: Uint8Array[] = [];
      const lineTimesMs: SpeakOutput['lineTimesMs'] = new Array(input.lines.length);
      let at = 0;
      runs.forEach((run, r) => {
        const pcm = runs.length > 1 ? trimSilence(parts[r]!.pcm, sampleRate, TTS_EDGE_KEEP_MS) : parts[r]!.pcm;
        if (r > 0) {
          pieces.push(gap);
          at += gap.length;
        }
        const base = at / bytesPerMs;
        const times = alignLines(pcm, sampleRate, run.map((i) => input.lines[i]!.text));
        run.forEach((i, j) => (lineTimesMs[i] = { startMs: Math.round(base + times[j]!.startMs), endMs: Math.round(base + times[j]!.endMs) }));
        pieces.push(pcm);
        at += pcm.length;
      });
      const pcm = new Uint8Array(at);
      let offset = 0;
      for (const p of pieces) {
        pcm.set(p, offset);
        offset += p.length;
      }
      return { pcm, sampleRate, bitsPerSample: 16, durationMs: Math.round(at / bytesPerMs), lineTimesMs };
    },
  };
}

export interface ChatJsonInput {
  apiKey: string;
  model: string;
  system: string;
  /** 대화(오래된 것부터). user와 model이 번갈아 오지 않아도 된다 */
  turns: { role: 'user' | 'model'; text: string }[];
  schema: unknown;
  timeoutMs?: number;
  /** usage_log에 남길 종류. 기본 'support' */
  kind?: UsageKind;
  onUsage?: (e: UsageEvent) => void;
}

/**
 * 대화 한 번으로 JSON 하나를 받는다(문의 답장 초안 apps/web/lib/server/inquiry-draft.ts, 추천 질문 lib/server/ask-suggest.ts): 시스템 지시와 대화로 JSON 하나.
 * 화면에서 기다리는 답이라 재시도·대체 모델 없이 한 번만 짧게 묻는다(실패하면 부른 쪽이 정해 둔 답을 쓴다)
 */
export async function geminiChatJson<T>(input: ChatJsonInput): Promise<T> {
  const client = new GoogleGenAI({ apiKey: input.apiKey });
  const res = await client.models.generateContent({
    model: input.model,
    contents: input.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    config: {
      systemInstruction: input.system,
      responseMimeType: 'application/json',
      responseJsonSchema: input.schema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
    },
  });
  const u = res.usageMetadata;
  input.onUsage?.({ model: res.modelVersion ?? input.model, kind: input.kind ?? 'support', inputTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0, thinkingTokens: u?.thoughtsTokenCount ?? 0 });
  const text = res.text;
  if (!text) throw new GeminiOutputError(input.model, `빈 응답(${res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'unknown'})`);
  return JSON.parse(text) as T;
}

export interface ChatStreamInput extends Omit<ChatJsonInput, 'schema'> {
  /** 받는 쪽이 떠나면 Gemini 호출도 끊는다 */
  signal?: AbortSignal;
}

/**
 * 대화 한 번의 답을 평문 조각으로 흘려 받는다(소식 물어보기 apps/web lib/server/ask.ts → 화면에 SSE로 바로 넘긴다).
 * geminiChatJson처럼 재시도·대체 모델 없이 한 번만. timeoutMs는 답 전체에 걸린다. 끊겨도 그때까지 쓴 토큰은 기록한다
 */
export async function* geminiChatStream(input: ChatStreamInput): AsyncGenerator<string> {
  const client = new GoogleGenAI({ apiKey: input.apiKey });
  const timeout = AbortSignal.timeout(input.timeoutMs ?? 15_000);
  const stream = await client.models.generateContentStream({
    model: input.model,
    contents: input.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    config: {
      systemInstruction: input.system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: input.signal ? AbortSignal.any([timeout, input.signal]) : timeout,
    },
  });
  let last: GenerateContentResponse | undefined;
  let wrote = false;
  try {
    for await (const chunk of stream) {
      last = chunk;
      const text = chunk.text;
      if (!text) continue;
      wrote = true;
      yield text;
    }
  } finally {
    const u = last?.usageMetadata;
    if (u) input.onUsage?.({ model: last?.modelVersion ?? input.model, kind: input.kind ?? 'support', inputTokens: u.promptTokenCount ?? 0, outputTokens: u.candidatesTokenCount ?? 0, thinkingTokens: u.thoughtsTokenCount ?? 0 });
  }
  if (!wrote) throw new GeminiOutputError(input.model, `빈 응답(${last?.candidates?.[0]?.finishReason ?? last?.promptFeedback?.blockReason ?? 'unknown'})`);
}
