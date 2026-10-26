// 여러 줄을 한 번에 합성한 음성에서 줄마다 시작·끝 시각을 찾는다(TTS는 줄별 시각을 주지 않는다).
// 문장 끝 쉼(0.5~1초)이 쉼표 쉼(0.2~0.4초)보다 확실히 길다(2026-10-26 Chirp 3 HD·Gemini TTS 실측).
// 그래서 경계 수만큼 쉼을 순서대로 고르되, 쉼 길이 합은 크고 글자 수로 어림한 위치에서는 덜 먼 조합을 고른다.
// 앞에서부터 하나씩 고르면 어림이 몇 초 어긋날 때 쉼표 쉼을 잡고 그 뒤가 줄줄이 밀려서 한꺼번에 고른다. 쉼이 모자라면 어림값을 쓴다.

/** 쉼을 재는 칸(ms) */
const FRAME_MS = 10;
/** 말소리 크기(상위 10% 칸)의 이 비율보다 작으면 조용한 칸 */
const QUIET_RATIO = 0.05;
/** 이보다 짧은 조용함은 쉼으로 보지 않는다(받침·파열음 사이 틈) */
const MIN_PAUSE_MS = 150;
/** 어림 위치에서 1초 멀어질 때 깎는 쉼 길이(ms). 문장 끝과 쉼표 쉼의 차이(약 0.2초)를 몇 초 거리로 뒤집지 않을 만큼만 */
const OFF_PENALTY_PER_SEC = 60;
/** 줄 사이 쉼을 글자 몇 개 길이로 보는지(어림용) */
const PAUSE_CHARS = 6;

interface Span {
  start: number;
  end: number;
}

/** 16비트 모노 PCM에서 조용한 구간(ms)과 말소리가 있는 범위 */
function scan(pcm: Uint8Array, sampleRate: number): { pauses: Span[]; speech: Span } {
  // 바이트 위치가 홀수면 Int16Array로 바로 볼 수 없어서 복사한다
  const s = pcm.byteOffset % 2 ? new Int16Array(pcm.slice().buffer, 0, pcm.length >> 1) : new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const rms: number[] = [];
  for (let i = 0; i + frame <= s.length; i += frame) {
    let sum = 0;
    for (let j = i; j < i + frame; j++) sum += s[j]! * s[j]!;
    rms.push(Math.sqrt(sum / frame));
  }
  const loud = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.9)] ?? 0;
  const quiet = (i: number) => rms[i]! < loud * QUIET_RATIO;
  let first = 0;
  while (first < rms.length && quiet(first)) first++;
  let last = rms.length - 1;
  while (last > first && quiet(last)) last--;
  const pauses: Span[] = [];
  let from = -1;
  for (let i = first; i <= last; i++) {
    if (quiet(i)) {
      if (from < 0) from = i;
    } else if (from >= 0) {
      if ((i - from) * FRAME_MS >= MIN_PAUSE_MS) pauses.push({ start: from * FRAME_MS, end: i * FRAME_MS });
      from = -1;
    }
  }
  return { pauses, speech: { start: first * FRAME_MS, end: Math.max(first, last + 1) * FRAME_MS } };
}

/** 경계 i마다 쉼 하나를 시간 순서대로 고른다(동적 계획법). 쉼이 경계보다 적으면 null */
function pickPauses(pauses: Span[], guesses: number[]): Span[] | null {
  const n = guesses.length;
  const m = pauses.length;
  if (m < n) return null;
  const gain = (i: number, k: number) => {
    const p = pauses[k]!;
    return p.end - p.start - (Math.abs((p.start + p.end) / 2 - guesses[i]!) / 1000) * OFF_PENALTY_PER_SEC;
  };
  // score[i][k]: 경계 i를 쉼 k로 했을 때 0..i까지의 최고 점수, from[i][k]: 그때 경계 i-1의 쉼
  const score: number[][] = [];
  const from: number[][] = [];
  for (let i = 0; i < n; i++) {
    score.push(new Array<number>(m).fill(-Infinity));
    from.push(new Array<number>(m).fill(-1));
    let best = -Infinity;
    let bestK = -1;
    // 경계 i는 쉼 i..m-n+i 중에서(앞뒤 경계 몫을 남긴다)
    for (let k = i; k <= m - n + i; k++) {
      if (i === 0) {
        score[i]![k] = gain(i, k);
        continue;
      }
      if (score[i - 1]![k - 1]! > best) {
        best = score[i - 1]![k - 1]!;
        bestK = k - 1;
      }
      score[i]![k] = best + gain(i, k);
      from[i]![k] = bestK;
    }
  }
  let k = score[n - 1]!.reduce((b, v, j) => (v > score[n - 1]![b]! ? j : b), 0);
  const picked: Span[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    picked[i] = pauses[k]!;
    k = from[i]![k]!;
  }
  return picked;
}

export function alignLines(pcm: Uint8Array, sampleRate: number, texts: string[]): { startMs: number; endMs: number }[] {
  if (!texts.length) return [];
  const { pauses, speech } = scan(pcm, sampleRate);
  const span = speech.end - speech.start;
  const total = texts.reduce((n, t) => n + t.length, 0) + (texts.length - 1) * PAUSE_CHARS || 1;
  // 줄 i와 i+1 사이 쉼 한가운데의 어림 시각
  const guesses: number[] = [];
  let chars = 0;
  for (let i = 0; i < texts.length - 1; i++) {
    chars += texts[i]!.length + PAUSE_CHARS;
    guesses.push(speech.start + ((chars - PAUSE_CHARS / 2) / total) * span);
  }
  const cuts = pickPauses(pauses, guesses) ?? guesses.map((g) => ({ start: Math.round(g), end: Math.round(g) }));
  return texts.map((_, i) => ({ startMs: i ? cuts[i - 1]!.end : speech.start, endMs: i < cuts.length ? cuts[i]!.start : speech.end }));
}
