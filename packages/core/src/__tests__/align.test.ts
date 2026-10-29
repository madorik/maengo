import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignLines } from '../audio/align';

const RATE = 24000;

/** ['tone', ms] = 말소리 대신 사인파, ['rest', ms] = 무음. 16비트 모노 PCM */
function pcmOf(parts: ['tone' | 'rest', number][], offset = 0): Uint8Array {
  const samples = parts.flatMap(([kind, ms]) => Array.from({ length: (RATE * ms) / 1000 }, (_, i) => (kind === 'tone' ? Math.round(8000 * Math.sin(i / 5)) : 0)));
  const out = new Uint8Array(offset + samples.length * 2);
  const view = new DataView(out.buffer);
  samples.forEach((v, i) => view.setInt16(offset + i * 2, v, true));
  return out.subarray(offset);
}

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 20, `${actual} ≈ ${expected}`);

test('alignLines: 쉼표 쉼(짧음)이 아니라 문장 끝 쉼(긺)에서 줄을 나눈다', () => {
  // 1문장(쉼표 포함) 3초, 2문장 2초, 3문장 1초
  const pcm = pcmOf([
    ['rest', 200],
    ['tone', 1500],
    ['rest', 250],
    ['tone', 1250],
    ['rest', 600],
    ['tone', 2000],
    ['rest', 700],
    ['tone', 1000],
    ['rest', 300],
  ]);
  const t = alignLines(pcm, RATE, ['가'.repeat(22) + ', ' + '나'.repeat(18) + '.', '다'.repeat(28) + '.', '라'.repeat(14) + '.']);
  near(t[0]!.startMs, 200);
  near(t[0]!.endMs, 3200);
  near(t[1]!.startMs, 3800);
  near(t[1]!.endMs, 5800);
  near(t[2]!.startMs, 6500);
  near(t[2]!.endMs, 7500);
});

test('alignLines: 글자 수 어림이 몇 초 어긋나도 긴 쉼을 고른다', () => {
  // 첫 줄은 글자가 적은데 소리는 길다(숫자·영어를 길게 읽는 경우)
  const pcm = pcmOf([
    ['tone', 4000],
    ['rest', 200],
    ['tone', 1000],
    ['rest', 650],
    ['tone', 2000],
  ]);
  const t = alignLines(pcm, RATE, ['짧은 줄 2026.', '두 번째 줄은 글자가 훨씬 많아서 어림이 앞으로 당겨진다.']);
  near(t[0]!.endMs, 5200);
  near(t[1]!.startMs, 5850);
});

test('alignLines: 쉼이 모자라면 글자 수로 나누고, 순서는 지킨다', () => {
  const pcm = pcmOf([['tone', 3000]]);
  const t = alignLines(pcm, RATE, ['가나다', '라마바', '사아자']);
  assert.equal(t[0]!.startMs, 0);
  assert.equal(t[2]!.endMs, 3000);
  for (let i = 1; i < t.length; i++) assert.ok(t[i]!.startMs >= t[i - 1]!.endMs);
});

test('alignLines: 바이트 위치가 홀수인 PCM도 읽는다', () => {
  const pcm = pcmOf(
    [
      ['tone', 1000],
      ['rest', 500],
      ['tone', 1000],
    ],
    1,
  );
  const t = alignLines(pcm, RATE, ['가나다.', '라마바.']);
  near(t[0]!.endMs, 1000);
  near(t[1]!.startMs, 1500);
});

test('alignLines: 한 줄이면 말소리 처음부터 끝까지(경계가 없어도 멈추지 않는다)', () => {
  const pcm = pcmOf([
    ['rest', 200],
    ['tone', 1000],
    ['rest', 300],
    ['tone', 500],
    ['rest', 200],
  ]);
  const [only, ...rest] = alignLines(pcm, RATE, ['안녕하세요, 맹고 아나운서예요.']);
  assert.equal(rest.length, 0);
  near(only!.startMs, 200);
  near(only!.endMs, 2000);
});
