import { NextResponse, type NextRequest } from "next/server";
import { isInUserFeed, setBookmark } from "@/lib/server/feed";
import { currentProfile } from "@/lib/server/session";

/** POST { clusterId, on: boolean } — 북마크 켜고 끄기(글 화면, components/article/BookmarkButton.tsx). 받은 적 있는 소식만 */
export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clusterId = Number(body?.clusterId);
  if (!Number.isInteger(clusterId) || typeof body?.on !== "boolean") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await isInUserFeed(profile, clusterId))) return NextResponse.json({ error: "not_in_feed" }, { status: 404 });
  await setBookmark(profile, clusterId, body.on);
  return NextResponse.json({ ok: true });
}
