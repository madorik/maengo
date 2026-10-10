import { NextResponse, type NextRequest } from "next/server";
import { episodeFileUrl, getItemEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { redirectToFile, ttsFailure } from "@/lib/server/file-response";
import { parseEpisodeParams } from "../../params";

// 처음 듣는 소식은 이 요청에서 음성을 만든다(소식당 30~40초, 전체 듣기는 몇 분까지)
export const maxDuration = 300;

// 소식 하나짜리 에피소드 파일. 주소가 정해져 있어서 탭하는 순간 play()를 걸고, 음성이 없으면 이 요청에서 만든 뒤 저장소로 넘긴다.
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return new NextResponse(null, { status: 401 });
  if (!entitlements(profile).audio) return new NextResponse(null, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!params || !Number.isInteger(id)) return new NextResponse(null, { status: 400 });
  try {
    const episode = await getItemEpisode(profile, id, params.persona, params.voice, { generate: true });
    const url = episode && (await episodeFileUrl(episode));
    if (!url) return new NextResponse(null, { status: 404 });
    return redirectToFile(request, url);
  } catch (e) {
    return ttsFailure(e);
  }
}
