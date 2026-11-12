import { after, NextResponse } from "next/server";
import { TOSS_CORS, tossTour, warmTossAudio } from "@/lib/server/toss";

// 응답 뒤에 아직 없는 음성을 만든다(소식 10개까지)
export const maxDuration = 300;

// 토스 미니앱 첫 화면 소식(둘러보기와 같은 모양, lib/server/toss.ts tossTour). 10분 동안 CDN이 들고 있는다
export async function GET() {
  const { items, missing } = await tossTour();
  if (missing.length) after(() => warmTossAudio(missing));
  return NextResponse.json({ items }, { headers: { ...TOSS_CORS, "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
