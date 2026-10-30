// 음성을 만드는 동안 트는 안내 뒤에 붙이는 '띵. 띵. 띵.' 소리(2026-10-30 사용자 결정: 만들고 있다는 느낌이 들게).
// 음성이 다 되면 PlayerProvider가 안내를 바로 끄므로, 기다리는 동안에만 들린다. 소리 파일 없이 사인파로 만든다.

/** 띵 하나의 높이(Hz). 순서대로 한 묶음으로 울린다 */
const NOTES_HZ = [1318.5, 1318.5, 1318.5];
const CHIME = {
  /** 안내 말이 끝나고 첫 띵까지 */
  gapMs: 700,
  /** 묶음 안에서 띵 사이 */
  stepMs: 600,
  /** 한 묶음이 시작해서 다음 묶음이 시작할 때까지 */
  cycleMs: 3000,
  /** 띵을 붙이는 길이. 이보다 오래 걸리면 그 뒤로는 조용하다 */
  totalMs: 30_000,
  /** 가장 큰 소리(1 = 최대). 말소리보다 한참 작게 */
  peak: 0.16,
};

/** 유리잔을 두드린 듯한 띵 하나: 기본음 + 빨리 사라지는 배음, 짧게 올라가서 천천히 줄어든다 */
function ding(out: Float32Array, at: number, hz: number, sampleRate: number) {
  const len = Math.min(out.length - at, Math.round(sampleRate * 1.2));
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.22);
    const w = 2 * Math.PI * hz * t;
    const v = Math.sin(w) + 0.35 * Math.sin(2 * w) * Math.exp(-t / 0.08) + 0.15 * Math.sin(2.76 * w) * Math.exp(-t / 0.05);
    out[at + i] += (CHIME.peak * env * v) / 1.5;
  }
}

/** 16비트 모노 PCM 뒤에 띵 소리를 붙인 새 PCM */
export function withChimes(pcm16: Uint8Array, sampleRate: number): Uint8Array {
  const ms = (n: number) => Math.round((n * sampleRate) / 1000);
  const tail = new Float32Array(ms(CHIME.gapMs + CHIME.totalMs));
  for (let start = ms(CHIME.gapMs); start < tail.length; start += ms(CHIME.cycleMs)) {
    NOTES_HZ.forEach((hz, i) => ding(tail, start + ms(i * CHIME.stepMs), hz, sampleRate));
  }
  const out = new Uint8Array(pcm16.byteLength + tail.length * 2);
  out.set(pcm16);
  const view = new DataView(out.buffer, pcm16.byteLength);
  tail.forEach((v, i) => view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true));
  return out;
}
