// WAV 인코더·디코더. Gemini TTS가 24kHz 16비트 WAV를 준다. 저장용 MP3 변환은 R2를 붙일 때 한다(PLAN.md 8.1).

export function wavHeader(dataBytes: number, sampleRate: number, bitsPerSample: 8 | 16): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const blockAlign = bitsPerSample / 8;
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  return header;
}

/** 같은 형식의 PCM 조각을 이어 붙여 WAV 하나로 만든다(재인코딩 없음 = MP3 concat -c copy와 같은 발상). */
export function concatWav(parts: Uint8Array[], sampleRate: number, bitsPerSample: 8 | 16): Uint8Array {
  const dataBytes = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(44 + dataBytes);
  out.set(wavHeader(dataBytes, sampleRate, bitsPerSample), 0);
  let at = 44;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** WAV에서 PCM과 형식을 꺼낸다. 헤더가 없으면(raw PCM) null */
export function parseWav(bytes: Uint8Array): { pcm: Uint8Array; sampleRate: number; bitsPerSample: 8 | 16; channels: number } | null {
  const ascii = (at: number) => String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
  if (bytes.length < 12 || ascii(0) !== 'RIFF' || ascii(8) !== 'WAVE') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sampleRate = 24000;
  let bitsPerSample: 8 | 16 = 16;
  let channels = 1;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = ascii(at);
    // 스트리밍으로 만든 WAV는 data 길이가 0이나 0xFFFFFFFF일 수 있어 남은 바이트로 자른다
    let size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      channels = view.getUint16(at + 10, true);
      sampleRate = view.getUint32(at + 12, true);
      bitsPerSample = view.getUint16(at + 22, true) === 8 ? 8 : 16;
    } else if (id === 'data') {
      if (size === 0 || at + 8 + size > bytes.length) size = bytes.length - at - 8;
      return { pcm: bytes.subarray(at + 8, at + 8 + size), sampleRate, bitsPerSample, channels };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}
