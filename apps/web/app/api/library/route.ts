import { NextResponse, type NextRequest } from "next/server";
import { parseLibraryPageSearch, type LibraryPageData } from "@/lib/library-pages";
import { getLibrary, LIBRARY_PAGE_SIZE } from "@/lib/server/feed";
import { currentProfile } from "@/lib/server/session";

/**
 * GET ?page=2&category=ai&read=unread&q=… → 보관함 한 쪽(앱의 이어 붙이기, components/library/InfiniteLibrary.tsx).
 * 화면(/library)과 같은 getLibrary를 쓰고, 이어 붙일 때 필요한 쪽 번호·쪽 수·날짜 묶음만 돌려준다
 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = parseLibraryPageSearch(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // 앞 쪽을 한 쪽만큼 겹쳐 준다: 앞 쪽을 받은 뒤 읽음 거르기 등으로 목록이 줄어 소식이 앞으로 당겨져도 건너뛰지 않게(겹친 건 화면이 거른다).
  // 오늘 보여 줄 개수는 1쪽을 그린 화면이 이미 맞췄다(syncToday)
  const lib = await getLibrary(profile, { ...params, overlap: LIBRARY_PAGE_SIZE, syncToday: false });
  const body: LibraryPageData = { page: lib.page, pageCount: lib.pageCount, groups: lib.groups };
  return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
}
