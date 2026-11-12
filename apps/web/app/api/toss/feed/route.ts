import { NextResponse, type NextRequest } from "next/server";
import { TOSS_CORS, TOSS_TOPIC_IDS, tossFeed } from "@/lib/server/toss";

// 토스 미니앱(apps/toss)의 소식 목록. 로그인 없이 공개 분야 소식만(lib/server/toss.ts). ?fields=ai,stock (없으면 토스판 분야 전부)
export async function GET(request: NextRequest) {
  const allowed: readonly string[] = TOSS_TOPIC_IDS;
  const fields = (request.nextUrl.searchParams.get("fields") ?? "").split(",").filter((f) => allowed.includes(f));
  const items = await tossFeed(fields);
  return NextResponse.json({ items }, { headers: { ...TOSS_CORS, "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
