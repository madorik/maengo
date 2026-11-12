import { NextResponse, type NextRequest } from "next/server";
import { TOSS_CORS, tossDetail } from "@/lib/server/toss";

// 토스 미니앱의 소식 상세(요약 전체 글·원문 링크). ?id=<소식 번호>
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: TOSS_CORS });
  const item = await tossDetail(id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404, headers: TOSS_CORS });
  return NextResponse.json({ item }, { headers: { ...TOSS_CORS, "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
