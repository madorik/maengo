import { NextResponse, type NextRequest } from "next/server";
import { isInUserFeed, markRead } from "@/lib/server/feed";
import { currentProfile } from "@/lib/server/session";

/** POST { clusterId, read?: true, listened?: true } */
export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clusterId = Number(body?.clusterId);
  if (!Number.isInteger(clusterId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!isInUserFeed(profile, clusterId)) return NextResponse.json({ error: "not_in_feed" }, { status: 404 });
  markRead(profile, clusterId, { read: body.read === true, listened: body.listened === true });
  return NextResponse.json({ ok: true });
}
