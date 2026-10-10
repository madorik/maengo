import { NextResponse } from "next/server";
import { ttsBlockedUntil } from "@/lib/server/limits";
import { currentProfile } from "@/lib/server/session";

/** GET → 서비스 전체 음성 한도가 찼는지(음성 실패 안내에 쓴다) */
export async function GET() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ busy: (await ttsBlockedUntil()) !== null }, { headers: { "cache-control": "no-store" } });
}
