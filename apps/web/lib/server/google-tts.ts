import 'server-only';
import type { SpeakInput, SpeakOutput } from '@maengo/core/ai';
import { parseWav } from '@maengo/core/audio';
import type { Persona } from '@maengo/core/types';

// Google Cloud Text-to-Speech, Chirp 3: HD 한국어 목소리. 2026-10-10 Gemini TTS(무료 등급 하루 10번)에서 바꿨다.
// 과금은 글자 수(공백 포함, 한글도 1자). 매월 100만 자 무료, 그 뒤 100만 자당 $30. 요청 하나에 5,000바이트(한글 약 1,600자)까지.
// 대본을 줄마다 따로 만들어 이어 붙인다. 대담은 줄마다 목소리가 다르고, 줄별 시각을 정확히 알 수 있고, 5,000바이트 한도에 걸리지 않는다.

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
/**
 * 말투별 목소리(ko-KR-Chirp3-HD-이름). 아나운서·대담은 Gemini 때와 같은 Kore(여)·Charon(남),
 * 선생님은 Achernar(여)·Achird(남)(2026-10-10 사용자 지정). 대담은 진행자 = f, 해설자 = m
 */
const VOICES: Record<Persona, { f: string; m: string }> = {
  announcer: { f: 'Kore', m: 'Charon' },
  teacher: { f: 'Achernar', m: 'Achird' },
  dialogue: { f: 'Kore', m: 'Charon' },
};

/** 음성 캐시 키에 넣을 실제 목소리 이름(목소리를 바꾸면 새로 만들게) */
export function chirpVoiceId(persona: Persona, vk: 'f' | 'm' | 'pair'): string {
  const v = VOICES[persona];
  return vk === 'pair' ? `${v.f}+${v.m}` : v[vk];
}
const SAMPLE_RATE = 24000;
/** 줄 사이 쉼. 문단이 바뀌거나 말하는 사람이 바뀌면 조금 더 쉰다 */
const GAP_MS = 300;
const TURN_GAP_MS = 550;
/** 말투별 빠르기(1이 기본). 아나운서는 조금 빠르게, 선생님은 조금 천천히 */
const RATE: Record<Persona, number> = { announcer: 1.05, teacher: 0.95, dialogue: 1 };
/** 한 소식의 줄을 동시에 몇 개까지 만들지 */
const PARALLEL = 4;

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
    return wav.pcm;
  }

  return {
    provider: 'google',
    async speak(input) {
      const pair = input.voice === 'pair';
      const rate = RATE[input.persona];
      const voiceOf = (who?: string): 'f' | 'm' => (pair ? (who === '진행자' ? 'f' : 'm') : (input.voice as 'f' | 'm'));
      const pcms: Uint8Array[] = new Array(input.lines.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, input.lines.length) }, async () => {
          while (next < input.lines.length) {
            const i = next++;
            const line = input.lines[i]!;
            pcms[i] = await synth(line.text, VOICES[input.persona][voiceOf(line.who)], rate);
          }
        }),
      );
      opts.onChars?.(input.lines.reduce((n, l) => n + l.text.length, 0));

      // 줄 사이에 쉼을 넣어 이어 붙이고, 줄마다 시작·끝 시각을 잰다
      const bytesPerMs = (SAMPLE_RATE * 2) / 1000;
      const silence = (ms: number) => new Uint8Array(Math.round((ms * bytesPerMs) / 2) * 2);
      const parts: Uint8Array[] = [];
      const lineTimesMs: { startMs: number; endMs: number }[] = [];
      let at = 0;
      input.lines.forEach((line, i) => {
        if (i > 0) {
          const prev = input.lines[i - 1]!;
          const turn = prev.who !== line.who || (prev.para !== undefined && prev.para !== line.para);
          const gap = silence(turn ? TURN_GAP_MS : GAP_MS);
          parts.push(gap);
          at += gap.length;
        }
        const pcm = pcms[i]!;
        lineTimesMs.push({ startMs: Math.round(at / bytesPerMs), endMs: Math.round((at + pcm.length) / bytesPerMs) });
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
