import { NextResponse } from "next/server";
import { TOSS_CORS, tossWeeklyReport } from "@/lib/server/toss";

// 주마다 처음 만들 때 Gemini 한 번(수십 초까지)
export const maxDuration = 120;

// 토스 미니앱 주간 리포트(공통판, 지난주 토스판 분야 소식). 못 만들면 report: null
export async function GET() {
  const report = await tossWeeklyReport();
  return NextResponse.json({ report }, { headers: { ...TOSS_CORS, "cache-control": report ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } });
}
