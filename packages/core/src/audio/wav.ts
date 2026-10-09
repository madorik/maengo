// 더미 TTS가 쓰는 WAV 인코더. 실제 오디오는 MP3(ffmpeg)로 만든다(PLAN.md 8.1).

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
