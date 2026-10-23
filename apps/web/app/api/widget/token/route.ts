import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/session";
import { signWidgetToken } from "@/lib/server/widget-token";

/** POST → { token }. 로그인한 앱이 홈 화면 위젯에 넘길 토큰을 받는다(lib/native/widget.ts) */
export async function POST() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ token: await signWidgetToken(profile.id) }, { headers: { "cache-control": "no-store" } });
}
