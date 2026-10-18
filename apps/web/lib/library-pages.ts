import { isCategory, type CategoryId } from "@maengo/core/categories";
import { parseLibraryQuery } from "./library-search";
import type { LibraryData, LibraryReadFilter } from "./types";

// 앱 보관함의 이어 붙이기(components/library/InfiniteLibrary.tsx)와 쪽 받기(/api/library)가 같이 쓰는 순수 함수.
// 쪽마다 날짜 묶음이 따로 와서, 쪽 경계에 걸친 날짜는 하나로 합치고 겹친 소식(받는 사이 새 소식이 앞에 들어와 밀린 것)은 뺀다.

export type LibraryGroup = LibraryData["groups"][number];

/** /api/library가 돌려주는 한 쪽(거르기 줄·개수는 1쪽을 그린 서버 값을 그대로 쓴다) */
export type LibraryPageData = Pick<LibraryData, "page" | "pageCount" | "groups">;

export interface LibraryFilters {
  category: CategoryId | null;
  read: LibraryReadFilter | null;
  query: string | null;
}

/** 지금까지 이어 붙인 쪽(1쪽은 서버가 그린 것이라 pages에는 2쪽부터 들어간다) */
export interface LoadedPages {
  page: number;
  pageCount: number;
  pages: LibraryGroup[][];
}

/** 주소로 받는 쪽 번호 상한 */
const PAGE_MAX = 10_000;

/** /api/library의 검색 문자열(page=2&category=ai&read=unread&q=…) */
export function libraryPageSearch(page: number, f: LibraryFilters): string {
  const q = new URLSearchParams({ page: String(page) });
  if (f.category) q.set("category", f.category);
  if (f.read) q.set("read", f.read);
  if (f.query) q.set("q", f.query);
  return q.toString();
}

/** /api/library의 검색 문자열을 읽는다. 쪽 번호·카테고리·읽음 값이 이상하면 null */
export function parseLibraryPageSearch(search: URLSearchParams): ({ page: number } & LibraryFilters) | null {
  const page = Number(search.get("page"));
  if (!Number.isInteger(page) || page < 1 || page > PAGE_MAX) return null;
  const category = search.get("category");
  if (category !== null && !isCategory(category)) return null;
  const read = search.get("read");
  if (read !== null && read !== "unread") return null;
  return { page, category, read, query: parseLibraryQuery(search.get("q") ?? undefined) };
}

/** 거르기(카테고리·읽음·검색어)가 같은지 가르는 열쇠 */
export function libraryFilterKey(f: LibraryFilters): string {
  return JSON.stringify([f.category, f.read, f.query]);
}

/** 1쪽이 그때와 같은지(되살린 쪽을 붙여도 되는지) 보는 값: 개수와 1쪽 소식 순서 */
export function librarySignature(d: { filteredTotal: number; pageCount: number; groups: LibraryGroup[] }): string {
  const ids = d.groups.flatMap((g) => g.entries.map((e) => `${e.clusterId}:${e.feedDate}`));
  return `${d.filteredTotal}|${d.pageCount}|${ids.join(",")}`;
}

/** 쪽들을 이어 붙인다. 같은 날짜는 한 묶음(처음 나온 자리), 같은 소식(clusterId+feedDate)은 처음 것만 */
export function mergeLibraryGroups(...lists: LibraryGroup[][]): LibraryGroup[] {
  const out: LibraryGroup[] = [];
  const byDate = new Map<string, LibraryGroup>();
  const seen = new Set<string>();
  for (const groups of lists) {
    for (const g of groups) {
      const fresh = g.entries.filter((e) => {
        const key = `${e.clusterId}:${e.feedDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!fresh.length) continue;
      const have = byDate.get(g.date);
      if (have) have.entries.push(...fresh);
      else {
        const group = { date: g.date, label: g.label, entries: fresh };
        byDate.set(g.date, group);
        out.push(group);
      }
    }
  }
  return out;
}

/**
 * 받은 쪽을 붙인다. 바로 다음 쪽이 아니면(늦게 온 응답) 그대로 두고,
 * 받는 사이 목록이 줄어 서버가 앞 쪽으로 돌려줬으면(getLibrary가 마지막 쪽으로 맞춘다) 거기서 끝낸다
 */
export function appendLibraryPage(s: LoadedPages, requested: number, data: LibraryPageData): LoadedPages {
  if (requested !== s.page + 1) return s;
  if (data.page !== requested) return { ...s, pageCount: s.page };
  return { page: data.page, pageCount: data.pageCount, pages: [...s.pages, data.groups] };
}
