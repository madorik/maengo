import type { Topic } from '../types';
import { TOPICS } from './dictionary';

// 키워드(설정 > 키워드): 목록에 없는 말을 직접 적은 것. 적은 그대로 내 토픽에 올린다.
// - 사전에 같은 이름·별칭이 있으면 그 관심사로 연결한다('청약' → 청약·분양)
// - 없으면 새 관심사(custom)로 만든다. 같은 말이면 사용자끼리 같은 관심사를 쓴다(id = 내용 해시)
// - 성인 키워드는 받지 않는다

/** 한 번에 받는 관심사 수와 길이 */
export const MAX_INTERESTS_PER_INPUT = 3;
export const MAX_INTEREST_LENGTH = 30;

/** 쉼표·가운뎃점·줄바꿈, '그리고·및', 붙여 쓴 '~이랑·~랑·~하고'로 나눈다 */
export function splitInterests(text: string): string[] {
  const parts = text
    .split(/[,，、·/\n;]+|\s+(?:그리고|및|and)\s+|(?:이랑|랑|하고)\s+/i)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = normalizeInterest(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p.slice(0, MAX_INTEREST_LENGTH));
  }
  return out.slice(0, MAX_INTERESTS_PER_INPUT);
}

/** 비교용: 소문자, 공백·기호 제거 */
export function normalizeInterest(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 사전에서 이름·별칭이 똑같은 관심사(띄어쓰기·대소문자 무시) */
export function findTopicByName(text: string, dictionary: readonly Topic[] = TOPICS): Topic | null {
  const key = normalizeInterest(text);
  if (!key) return null;
  return dictionary.find((t) => [t.name, ...t.aliases].some((n) => normalizeInterest(n) === key)) ?? null;
}

/** 새 관심사의 id. 같은 말이면 같은 id(사용자끼리 공유) */
export function customTopicId(text: string): string {
  // FNV-1a 32비트 두 번(앞뒤 시드 다르게) → 16자리. 사전 id와 겹치지 않게 'c-'를 붙인다
  const key = normalizeInterest(text);
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (const ch of key) {
      h ^= ch.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return `c-${fnv(0x811c9dc5)}${fnv(0x01000193)}`;
}

export function isCustomTopicId(id: string): boolean {
  return /^c-[0-9a-f]{16}$/.test(id);
}

// 성인 키워드. 공백·기호를 빼고 소문자로 비교한다(띄어 쓰거나 기호를 섞어도 걸리게).
// '성인'만으로는 막지 않는다(성인 ADHD, 성인 교육 같은 말이 있어서). 성인물·성인용품처럼 붙은 말을 막는다.
const ADULT = [
  '야동', '야사', '야한', '포르노', '섹스', '섹시', '음란', '누드', '에로', '19금', '성인물', '성인용품', '성인영상', '성인방송', '성인사이트',
  '성매매', '조건만남', '원나잇', '몸캠', '자위', '성인웹툰', '룸살롱', '유흥업소', '오피걸', '키스방', '립카페', '스와핑', '페티시', '노출사진', 'av배우',
  'porn', 'nsfw', 'hentai', 'onlyfans', 'erotic', 'fetish', 'bdsm', 'camgirl',
];
// 짧은 영어 단어는 낱말 첫머리에서만 막는다(Sussex, Essex 같은 지명이 걸리지 않게)
const ADULT_WORD_START = /(^|[^a-z])(sex|xxx|nude|milf|escort)/;

export function isAdultInterest(text: string): boolean {
  const key = normalizeInterest(text);
  return ADULT.some((w) => key.includes(normalizeInterest(w))) || ADULT_WORD_START.test(text.toLowerCase());
}
