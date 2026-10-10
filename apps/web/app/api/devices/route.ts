import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { currentProfile } from "@/lib/server/session";

// 푸시를 받을 기기 토큰(FCM) 등록·삭제. 앱은 알림 권한을 받은 뒤와 앱을 열 때마다 등록해 last_seen_at을 갱신한다(토큰은 바뀔 수 있다).
// 보내기는 서버 스케줄러(pipeline/src/deliveries.ts)가 이 표(device_tokens)로 한다.
const PLATFORMS = ["android", "ios", "web"] as const;
type Platform = (typeof PLATFORMS)[number];

async function body(request: NextRequest): Promise<{ token?: unknown; platform?: unknown; appVersion?: unknown }> {
  try {
    return (await request.json()) as { token?: unknown; platform?: unknown; appVersion?: unknown };
  } catch {
    return {};
  }
}

const validToken = (t: unknown): t is string => typeof t === "string" && t.length > 20 && t.length < 4096;

/** POST {token, platform: 'android'|'ios'|'web', appVersion?} */
export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { token, platform, appVersion } = await body(request);
  if (!validToken(token) || !PLATFORMS.includes(platform as Platform)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await db.from("device_tokens").upsert(
    { token, user_id: profile.id, platform, app_version: typeof appVersion === "string" ? appVersion.slice(0, 40) : null, last_seen_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE {token}: 로그아웃·알림 끄기 */
export async function DELETE(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { token } = await body(request);
  if (!validToken(token)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await db.from("device_tokens").delete().eq("token", token).eq("user_id", profile.id);
  return NextResponse.json({ ok: true });
}
