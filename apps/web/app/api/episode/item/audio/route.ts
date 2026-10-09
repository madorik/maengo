import { NextResponse, type NextRequest } from "next/server";
import { getItemEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/store";
import { wavResponse } from "@/lib/server/wav-response";
import { parseEpisodeParams } from "../../params";

// 소식 하나짜리 에피소드 파일(더미 WAV). 주소가 정해져 있어서 탭하는 순간 바로 재생을 걸 수 있다.
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return new NextResponse(null, { status: 401 });
  if (!entitlements(profile).audio) return new NextResponse(null, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!params || !Number.isInteger(id)) return new NextResponse(null, { status: 400 });
  const episode = await getItemEpisode(profile, id, params.persona, params.voice);
  if (!episode) return new NextResponse(null, { status: 404 });
  return wavResponse(request, episode.wav);
}
