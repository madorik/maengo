import { NextResponse, type NextRequest } from "next/server";
import { askAboutItem, parseHistory, type AskError } from "@/lib/server/ask";
import { currentProfile } from "@/lib/server/session";

// 글 화면의 맹고 AI(components/article/AskDock.tsx). POST { clusterId, question, history } → { answer, related } (lib/server/ask.ts)
export const maxDuration = 30;

const STATUS: Record<AskError, number> = { empty: 400, too_long: 400, not_found: 404, daily_limit: 429, busy: 503 };

export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clusterId = Number(body?.clusterId);
  if (!Number.isInteger(clusterId) || typeof body?.question !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const res = await askAboutItem(profile, clusterId, body.question, parseHistory(body.history));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: STATUS[res.error] });
  return NextResponse.json({ answer: res.answer, related: res.related });
}
