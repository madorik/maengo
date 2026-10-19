// 보관함 검색(?q=). 제목·요약·출처·글쓴이에서 찾는다. 띄어쓰기와 대소문자는 가리지 않고("AI해킹"으로 "AI 해킹"을 찾는다),
// 검색어를 띄어 쓰면 모든 낱말이 들어간 소식만 남긴다.
// 거르기는 DB가 한다(library_page, supabase/migrations/20261019120000_library_page.sql): 여기서는 검색어를 그 규칙에 맞는 낱말로만 다듬는다.

/** 주소로 받는 검색어 길이 상한 */
export const LIBRARY_QUERY_MAX = 40;

/** 주소의 ?q=를 다듬는다. 비면 null */
export function parseLibraryQuery(raw: string | string[] | undefined): string | null {
  const q = (Array.isArray(raw) ? raw[0] : raw)?.replace(/\s+/g, " ").trim().slice(0, LIBRARY_QUERY_MAX);
  return q ? q : null;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 검색어를 낱말로(소문자, 띄어쓰기 없이). DB가 이 낱말이 모두 들어간 소식만 남긴다. 검색어가 없으면 빈 배열 */
export function libraryTerms(query: string | null): string[] {
  return (query ?? "").split(" ").map(squash).filter(Boolean);
}
