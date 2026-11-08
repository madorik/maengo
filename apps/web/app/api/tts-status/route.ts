import { NextResponse } from "next/server";
import { ttsBlockedUntil } from "@/lib/server/limits";
import { currentProfile } from "@/lib/server/session";

/**
 * GET → 서비스 전체 음성 한도가 찼는지(busy). 음성 실패 안내에 쓴다(<audio>는 실패 응답 본문을 못 읽는다).
 * 2026-11-08 내 관심 링크 소식 하루 음성 몫(linkLimit)을 없앴다
 */
export async function GET() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const busy = (await ttsBlockedUntil()) !== null;
  return NextResponse.json({ busy }, { headers: { "cache-control": "no-store" } });
}
