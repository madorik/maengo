// 음성을 만드는 동안 트는 안내의 말 사이를 채우는 '띵. 띵. 띵.' 소리(2026-10-30 사용자 결정: 만들고 있다는 느낌이 들게).
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

/**
 * 기다림 안내 한 파일: 말(cues)을 정한 시각에 두고, 말 사이 빈 곳만 띵 묶음으로 채운다(말과 띵이 겹치지 않게). totalMs까지
 * (2026-11-27 사용자: 음성으로도 알려 줘야지 — 화면의 '곧 들려 드릴게요'·'조금 더 걸리고 있어요'를 같은 때 말한다, lib/voice-samples.ts waitCues).
 * 앞 말이 길어 다음 말 시각을 넘기면 다음 말은 앞 말이 끝나고 조금 뒤에
 */
export function composeWait(cues: { atMs: number; pcm16: Uint8Array }[], sampleRate: number, totalMs: number): Uint8Array {
  const ms = (n: number) => Math.round((n * sampleRate) / 1000);
  const out = new Float32Array(ms(totalMs));
  /** 말이 차지한 구간(샘플) */
  const spans: [number, number][] = [];
  let free = 0;
  for (const { atMs, pcm16 } of cues) {
    const view = new DataView(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    const len = pcm16.byteLength >> 1;
    const at = Math.max(ms(atMs), free);
    for (let i = 0; i < len && at + i < out.length; i++) out[at + i] = view.getInt16(i * 2, true) / 32768;
    spans.push([at, at + len]);
    free = at + len + ms(400);
  }
  // 띵 묶음 하나가 차지하는 길이(마지막 띵의 울림까지). 말 앞뒤로 이만큼은 비운다
  const groupLen = ms((NOTES_HZ.length - 1) * CHIME.stepMs + 1200);
  const clear = (from: number, to: number) => spans.every(([a, b]) => to + ms(300) <= a || from >= b + ms(CHIME.gapMs));
  for (let start = (spans[0]?.[1] ?? 0) + ms(CHIME.gapMs); start + groupLen < out.length; ) {
    if (clear(start, start + groupLen)) {
      NOTES_HZ.forEach((hz, i) => ding(out, start + ms(i * CHIME.stepMs), hz, sampleRate));
      start += ms(CHIME.cycleMs);
    } else {
      // 겹치는 말이 끝난 뒤로 옮긴다
      const blocking = spans.find(([a, b]) => !(start + groupLen + ms(300) <= a || start >= b + ms(CHIME.gapMs)))!;
      start = blocking[1] + ms(CHIME.gapMs);
    }
  }
  const pcm = new Uint8Array(out.length * 2);
  const view = new DataView(pcm.buffer);
  out.forEach((v, i) => view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true));
  return pcm;
}
