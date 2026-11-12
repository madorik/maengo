import { NextResponse } from "next/server";
import { TOSS_CORS, tossInsight } from "@/lib/server/toss";

// 처음 만들 때 Gemini 한 번(몇 초)
export const maxDuration = 60;

// 토스 미니앱 오늘의 흐름(공통판, lib/server/toss.ts tossInsight). 못 만들면 insight: null(화면은 원래 머리를 그대로 둔다)
export async function GET() {
  const made = await tossInsight();
  return NextResponse.json(made ?? { ids: [], insight: null }, {
    headers: { ...TOSS_CORS, "cache-control": made ? "public, s-maxage=600, stale-while-revalidate=3600" : "no-store" },
  });
}
