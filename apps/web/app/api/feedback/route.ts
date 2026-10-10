import type { FeedbackKind } from "@maengo/core/types";
import { NextResponse, type NextRequest } from "next/server";
import { isInUserFeed, setFeedback } from "@/lib/server/feed";
import { currentProfile } from "@/lib/server/session";

const KINDS: FeedbackKind[] = ["more", "known", "skip"];

/** POST { clusterId, kind: 'more'|'known'|'skip'|null } — null이면 피드백을 지운다 */
export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clusterId = Number(body?.clusterId);
  const kind = body?.kind ?? null;
  if (!Number.isInteger(clusterId) || (kind !== null && !KINDS.includes(kind))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!(await isInUserFeed(profile, clusterId))) return NextResponse.json({ error: "not_in_feed" }, { status: 404 });
  await setFeedback(profile, clusterId, kind);
  return NextResponse.json({ ok: true });
}
