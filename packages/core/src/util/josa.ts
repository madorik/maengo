// 받침에 따라 조사를 고른다. '보안을', '쿠버네티스를', 'PostgreSQL을'(엘), 'React를'(티).

// 영문 글자를 한국어로 읽었을 때 받침이 있는 것: L(엘) M(엠) N(엔) R(알)
const LATIN_BATCHIM = new Set(['l', 'm', 'n', 'r']);
// 숫자: 0(영) 1(일) 3(삼) 6(육) 7(칠) 8(팔)
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);

export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[a-z]/i.test(ch)) return LATIN_BATCHIM.has(ch.toLowerCase());
  return DIGIT_BATCHIM.has(ch);
}

/** josa('보안', '을', '를') → '보안을' */
export function josa(word: string, withBatchim: string, without: string): string {
  return word + (hasBatchim(word) ? withBatchim : without);
}
