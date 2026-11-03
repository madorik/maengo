import { NextResponse, type NextRequest } from "next/server";
import { suggestQuestions } from "@/lib/server/ask-suggest";
import { currentProfile } from "@/lib/server/session";

// 맹고 AI 추천 질문. GET ?clusterId= → { questions } (lib/server/ask-suggest.ts)
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clusterId = Number(request.nextUrl.searchParams.get("clusterId"));
  if (!Number.isInteger(clusterId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const questions = await suggestQuestions(profile, clusterId);
  if (!questions) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ questions }, { headers: { "cache-control": "private, max-age=3600" } });
}
