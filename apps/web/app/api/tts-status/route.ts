import { NextResponse, type NextRequest } from "next/server";
import { linkVoicesUsedUp } from "@/lib/server/episode";
import { ttsBlockedUntil } from "@/lib/server/limits";
import { currentProfile } from "@/lib/server/session";

/**
 * GET [?id=소식] → 서비스 전체 음성 한도가 찼는지(busy), 그 소식이 내 관심 링크 소식이고 오늘 새로 만들 수 있는 링크 음성을 다 썼는지(linkLimit).
 * 음성 실패 안내에 쓴다(<audio>는 실패 응답 본문을 못 읽는다)
 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(request.nextUrl.searchParams.get("id"));
  const [busy, linkLimit] = await Promise.all([ttsBlockedUntil().then((u) => u !== null), Number.isInteger(id) && id > 0 ? linkVoicesUsedUp(profile, id) : false]);
  return NextResponse.json({ busy, linkLimit }, { headers: { "cache-control": "no-store" } });
}
