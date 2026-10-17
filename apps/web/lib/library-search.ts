// 보관함 검색(?q=). 제목·요약·출처에서 찾는다. 띄어쓰기와 대소문자는 가리지 않고("AI해킹"으로 "AI 해킹"을 찾는다),
// 검색어를 띄어 쓰면 모든 낱말이 들어간 소식만 남긴다.

/** 주소로 받는 검색어 길이 상한 */
export const LIBRARY_QUERY_MAX = 40;

/** 주소의 ?q=를 다듬는다. 비면 null */
export function parseLibraryQuery(raw: string | string[] | undefined): string | null {
  const q = (Array.isArray(raw) ? raw[0] : raw)?.replace(/\s+/g, " ").trim().slice(0, LIBRARY_QUERY_MAX);
  return q ? q : null;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 검색어에 맞는 소식만 고르는 함수. 검색어가 없으면 모두 통과 */
export function libraryMatcher(query: string | null): (e: { title: string; short: string; sourceLabel: string; author: string }) => boolean {
  const terms = (query ?? "").split(" ").map(squash).filter(Boolean);
  if (!terms.length) return () => true;
  return (e) => {
    const hay = squash(`${e.title} ${e.short} ${e.sourceLabel} ${e.author}`);
    return terms.every((t) => hay.includes(t));
  };
}
