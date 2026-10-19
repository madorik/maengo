// 잔잔한 배경음악을 직접 합성한다(저작권 걱정 없는 음원). node bgm.mjs [초] [out.wav]
// 78 BPM, Cmaj7 → Am7 → Fmaj7 → G6 두 마디씩. 패드(느린 어택) + 베이스 + 가벼운 아르페지오.
import { writeFileSync } from "node:fs";

const SR = 44100;
const seconds = +(process.argv[2] || 26);
const out = process.argv[3] || "assets/bgm.wav";
const BPM = 78, beat = 60 / BPM, bar = beat * 4;
const N = Math.round(SR * seconds);
const L = new Float32Array(N), R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// 코드: [루트 미디, 구성음 미디 배열]
const CHORDS = [
  [48, [60, 64, 67, 71]], // Cmaj7
  [45, [57, 60, 64, 67]], // Am7
  [41, [53, 57, 60, 64]], // Fmaj7
  [43, [55, 59, 62, 64]], // G6
];
const chordAt = (t) => CHORDS[Math.floor(t / (bar * 2)) % CHORDS.length];

function addTone(buf, start, dur, freq, amp, { attack = 0.01, release = 0.3, harm2 = 0, harm3 = 0, decay = 0, pan = 0 } = {}) {
  const s0 = Math.max(0, Math.round(start * SR)), s1 = Math.min(N, Math.round((start + dur + release) * SR));
  const gl = Math.sqrt(0.5 - pan / 2), gr = Math.sqrt(0.5 + pan / 2);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    let env = t < attack ? t / attack : 1;
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    if (decay) env *= Math.exp(-t / decay);
    const ph = 2 * Math.PI * freq * t;
    const v = (Math.sin(ph) + harm2 * Math.sin(2 * ph) + harm3 * Math.sin(3 * ph)) * env * amp;
    L[i] += v * gl; R[i] += v * gr;
  }
}

// 패드: 코드마다 구성음을 살짝 어긋난 두 사인으로(코러스 느낌), 어택 1.2초
for (let t = 0; t < seconds; t += bar * 2) {
  const [, notes] = chordAt(t);
  notes.forEach((m, i) => {
    const f = midi(m);
    addTone(L, t, bar * 2 - 0.2, f * 1.0015, 0.045, { attack: 1.2, release: 1.4, harm2: 0.15, pan: -0.3 + i * 0.2 });
    addTone(L, t, bar * 2 - 0.2, f * 0.9985, 0.045, { attack: 1.2, release: 1.4, harm2: 0.15, pan: 0.3 - i * 0.2 });
  });
}
// 베이스: 루트, 2분음표마다, 부드럽게
for (let t = 0; t < seconds; t += beat * 2) {
  const [root] = chordAt(t);
  addTone(L, t + 0.02, beat * 1.6, midi(root), 0.11, { attack: 0.06, release: 0.4, harm2: 0.2 });
}
// 아르페지오: 8분음표 패턴, 한 옥타브 위, 짧은 감쇠. 쉼표를 섞어 잔잔하게
const pattern = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
let k = 0;
for (let t = 0; t < seconds; t += beat / 2, k++) {
  if (!pattern[k % pattern.length]) continue;
  const [, notes] = chordAt(t);
  const m = notes[(k * 7) % notes.length] + 12;
  const vel = 0.08 + 0.04 * Math.abs(Math.sin(k * 1.3));
  addTone(L, t, 0.05, midi(m), vel, { attack: 0.004, release: 0.6, decay: 0.45, harm2: 0.1, harm3: 0.05, pan: ((k % 5) - 2) * 0.15 });
}

// 페이드 인·아웃, 소프트 리미터, 16비트 WAV
const fadeIn = SR * 1.2, fadeOut = SR * 2.5;
let peak = 0;
for (let i = 0; i < N; i++) {
  let g = 1;
  if (i < fadeIn) g = i / fadeIn;
  if (i > N - fadeOut) g = Math.min(g, (N - i) / fadeOut);
  L[i] = Math.tanh(L[i] * 1.6) * g; R[i] = Math.tanh(R[i] * 1.6) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.6 / peak;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4);
  pcm.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVE", 8);
hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
writeFileSync(out, Buffer.concat([hdr, pcm]));
console.log("wrote", out, seconds + "s", "peak", peak.toFixed(2));
