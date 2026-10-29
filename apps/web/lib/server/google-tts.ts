import 'server-only';
import type { SpeakInput, SpeakOutput } from '@maengo/core/ai';
import { alignLines, parseWav, trimSilence } from '@maengo/core/audio';
import type { Voice } from '@maengo/core/types';

// Google Cloud Text-to-Speech, Chirp 3: HD 한국어 목소리. 2026-10-10 Gemini TTS(무료 등급 하루 10번)에서 바꿨다.
// 과금은 글자 수(공백 포함, 한글도 1자). 매월 100만 자 무료, 그 뒤 100만 자당 $30. 요청 하나에 5,000바이트(한글 약 1,600자)까지.
// 같은 사람이 말하는 한 문단을 한 번에 만들어 이어 붙인다. 처음엔 줄(문장)마다 따로 만들었는데 문장마다 억양이 처음부터 다시 시작해
// 뚝뚝 끊겨 들렸다(2026-10-26). 문단 안 줄별 시각은 음성의 쉼으로 찾는다(core/audio/align.ts).
// Chirp는 요청마다 음성 앞뒤에 무음(0.2~0.4초)을 붙여서, 문단을 그대로 이어 붙이면 이음매마다 1초 가까이 비어 다시 끊겨 들렸다(2026-10-29).
// 그래서 앞뒤 무음을 조금만 남기고 잘라 낸 뒤 정한 쉼만 넣는다(문장 사이 쉼 0.2~0.4초와 비슷하게, 문단 사이는 조금 더).

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
/** 목소리(ko-KR-Chirp3-HD-이름). Gemini 때와 같은 Kore(여)·Charon(남) */
const VOICES: Record<Voice, string> = { f: 'Kore', m: 'Charon' };

/** 음성 캐시 키에 넣을 실제 목소리 이름(목소리를 바꾸면 새로 만들게) */
export function chirpVoiceId(voice: Voice): string {
  return VOICES[voice];
}
const SAMPLE_RATE = 24000;
/** 줄 묶음 사이 쉼(앞뒤 무음을 잘라 낸 뒤 넣는다). 문단이 바뀌면 조금 더 쉰다(제목 다음은 짧게) */
const GAP_MS = 280;
const PARA_GAP_MS = 380;
/** 잘라 낼 때 음성 앞뒤에 남기는 무음(말끝이 잘리지 않게) */
const EDGE_KEEP_MS = 60;
/** 빠르기(1이 기본). 1.05였다가 1로(2026-10-26: 플레이어 속도 1.0x가 원래 빠르기가 되게, 빠르게 듣고 싶으면 플레이어에서 올린다) */
const RATE = 1;
/** 한 소식의 문단을 동시에 몇 개까지 만들지 */
const PARALLEL = 4;
/** 한 번에 보낼 글 크기. 요청 한도 5,000바이트보다 넉넉히 작게, 넘으면 문단을 나눠 보낸다 */
const MAX_BYTES = 4000;

/** 요청 한도(분당 요청 수 등)에 걸렸다. retryMs는 Google이 알려 준 대기 시간(모르면 null) */
export class TtsQuotaError extends Error {
  constructor(
    message: string,
    readonly retryMs: number | null,
  ) {
    super(message);
    this.name = 'TtsQuotaError';
  }
}

export interface TtsClient {
  readonly provider: 'dummy' | 'gemini' | 'google';
  speak(input: SpeakInput): Promise<SpeakOutput>;
}

export function createGoogleTts(opts: { apiKey: string; onChars?: (chars: number) => void }): TtsClient {
  async function synth(text: string, name: string, rate: number): Promise<Uint8Array> {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ko-KR', name: `ko-KR-Chirp3-HD-${name}` },
        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: SAMPLE_RATE, speakingRate: rate },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      if (res.status === 429) {
        const after = Number(res.headers.get('retry-after'));
        throw new TtsQuotaError(`Google TTS 한도: ${body}`, after > 0 ? after * 1000 : null);
      }
      throw new Error(`Google TTS ${res.status}: ${body}`);
    }
    const { audioContent } = (await res.json()) as { audioContent?: string };
    if (!audioContent) throw new Error('Google TTS 응답에 음성이 없어요');
    // LINEAR16은 WAV 머리말이 붙어 온다
    const wav = parseWav(new Uint8Array(Buffer.from(audioContent, 'base64')));
    if (!wav || wav.bitsPerSample !== 16 || wav.channels !== 1 || wav.sampleRate !== SAMPLE_RATE) throw new Error('Google TTS 음성 형식이 예상(24kHz 16비트 모노)과 달라요');
    return trimSilence(wav.pcm, SAMPLE_RATE, EDGE_KEEP_MS);
  }

  return {
    provider: 'google',
    async speak(input) {
      const textOf = (run: number[]) => run.map((i) => input.lines[i]!.text).join(' ');
      // 같은 문단 줄을 하나로 묶는다(줄 번호 목록). 제목·마무리처럼 문단 번호가 없는 줄은 혼자
      const runs: number[][] = [];
      input.lines.forEach((line, i) => {
        const run = runs.at(-1);
        const prev = run && input.lines[run.at(-1)!]!;
        const same = prev?.para !== undefined && prev.para === line.para;
        if (run && same && Buffer.byteLength(textOf(run)) + 1 + Buffer.byteLength(line.text) <= MAX_BYTES) run.push(i);
        else runs.push([i]);
      });
      const pcms: Uint8Array[] = new Array(runs.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, runs.length) }, async () => {
          while (next < runs.length) {
            const r = next++;
            const run = runs[r]!;
            pcms[r] = await synth(textOf(run), VOICES[input.voice], RATE);
          }
        }),
      );
      opts.onChars?.(runs.reduce((n, run) => n + textOf(run).length, 0));

      // 문단 사이에 쉼을 넣어 이어 붙인다. 줄 시각은 혼자인 줄이면 음성 전체, 묶인 줄이면 쉼으로 찾는다
      const bytesPerMs = (SAMPLE_RATE * 2) / 1000;
      const silence = (ms: number) => new Uint8Array(Math.round((ms * bytesPerMs) / 2) * 2);
      const parts: Uint8Array[] = [];
      const lineTimesMs: { startMs: number; endMs: number }[] = new Array(input.lines.length);
      let at = 0;
      runs.forEach((run, r) => {
        if (r > 0) {
          const prev = input.lines[runs[r - 1]!.at(-1)!]!;
          const line = input.lines[run[0]!]!;
          const newPara = prev.para !== undefined && prev.para !== line.para;
          const gap = silence(newPara ? PARA_GAP_MS : GAP_MS);
          parts.push(gap);
          at += gap.length;
        }
        const pcm = pcms[r]!;
        const base = at / bytesPerMs;
        const times = run.length > 1 ? alignLines(pcm, SAMPLE_RATE, run.map((i) => input.lines[i]!.text)) : [{ startMs: 0, endMs: pcm.length / bytesPerMs }];
        run.forEach((i, j) => (lineTimesMs[i] = { startMs: Math.round(base + times[j]!.startMs), endMs: Math.round(base + times[j]!.endMs) }));
        parts.push(pcm);
        at += pcm.length;
      });
      const pcm = new Uint8Array(at);
      let offset = 0;
      for (const p of parts) {
        pcm.set(p, offset);
        offset += p.length;
      }
      return { pcm, sampleRate: SAMPLE_RATE, bitsPerSample: 16, durationMs: Math.round(at / bytesPerMs), lineTimesMs };
    },
  };
}
