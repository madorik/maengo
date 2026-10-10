import 'server-only';
import { Mp3Encoder } from '@breezystack/lamejs';

// 듣기 음성은 MP3(모노, 48kbps CBR)로 저장한다. 말소리라 이 정도면 충분하고, WAV보다 8배쯤 작다.
// CBR이고 앞에 Xing/Info 프레임이 없어서 파일을 바이트 그대로 이어 붙여도 재생·탐색이 된다.
export const MP3_KBPS = 48;

export function encodeMp3(pcm16: Uint8Array, sampleRate: number): Uint8Array {
  const samples = new Int16Array(pcm16.buffer, pcm16.byteOffset, Math.floor(pcm16.byteLength / 2));
  const enc = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunks: Uint8Array[] = [];
  const step = 1152 * 16;
  for (let i = 0; i < samples.length; i += step) chunks.push(enc.encodeBuffer(samples.subarray(i, i + step)));
  chunks.push(enc.flush());
  return concatBytes(chunks);
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** CBR이라 길이는 바이트 수로 정확히 나온다 */
export function mp3DurationMs(bytes: number): number {
  return Math.round((bytes * 8) / MP3_KBPS);
}
