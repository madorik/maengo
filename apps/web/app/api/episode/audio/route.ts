import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { getEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/store";
import { wavResponse } from "@/lib/server/wav-response";
import { parseEpisodeParams } from "../params";

// 오늘 에피소드 파일(더미 WAV). 실제로는 R2의 MP3를 바로 재생한다.
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return new NextResponse(null, { status: 401 });
  if (!entitlements(profile).audio) return new NextResponse(null, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  if (!params) return new NextResponse(null, { status: 400 });
  const date = request.nextUrl.searchParams.get("date") ?? kstDate();
  if (date !== kstDate()) return new NextResponse(null, { status: 404 });

  const { wav } = await getEpisode(profile, date, params.persona, params.voice);
  return wavResponse(request, wav);
}
