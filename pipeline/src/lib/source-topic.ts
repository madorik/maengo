import { TOPIC_BY_ID } from '@maengo/core/topics';
import { SOURCES } from '../sources';

// 출처 분야(sources.ts의 topic). 분야를 정해 둔 출처의 글은 관심사 낱말이 제목·설명에 없어도 임베딩한다(lib/interest.ts).
// 영문 글은 별칭(대개 한글)에 잘 걸리지 않아서다: 2026-10-23 Tech만 고른 사람 기준 최근 7일 Hacker News 0/17, The Hacker News 6/60, Vercel 1/16.
// DB에는 넣지 않고 코드에서 url로 찾는다(section과 같다).

export const TOPIC_BY_SOURCE_URL: ReadonlyMap<string, string> = new Map(SOURCES.filter((s) => s.topic).map((s) => [s.url, s.topic!]));

/** 이 분야 출처의 글이 필요한지: 누군가 그 분야나 그 큰 분류, 또는 그 아래 상세 관심사를 골랐으면 */
export function wantsSourceTopic(topic: string, inUse: ReadonlySet<string>): boolean {
  if (inUse.has(topic)) return true;
  const parent = TOPIC_BY_ID.get(topic)?.parent;
  if (parent && inUse.has(parent)) return true;
  for (const t of inUse) if (TOPIC_BY_ID.get(t)?.parent === topic) return true;
  return false;
}
