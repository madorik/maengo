import { NextResponse, type NextRequest } from "next/server";
import { episodeFileUrl, getPlaylistEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { redirectToFile, ttsFailure } from "@/lib/server/file-response";
import { parsePlaylistIds } from "@/lib/playlist";
import { parseEpisodeParams } from "../../params";

// 처음 듣는 소식은 이 요청에서 음성을 만든다(소식당 몇 초, 한 번에 세 개씩)
export const maxDuration = 300;

// 보관함 플레이리스트 파일(Premium). 고른 소식의 음성을 이어 붙여 저장소로 넘긴다. 없는 음성은 이 요청에서 만든다.
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return new NextResponse(null, { status: 401 });
  if (!entitlements(profile).audio) return new NextResponse(null, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const ids = parsePlaylistIds(request.nextUrl.searchParams.get("ids"));
  if (!params || !ids) return new NextResponse(null, { status: 400 });
  try {
    const { episode } = await getPlaylistEpisode(profile, ids, params.persona, params.voice, { generate: true });
    const url = await episodeFileUrl(episode);
    if (!url) return new NextResponse(null, { status: 404 });
    return redirectToFile(request, url);
  } catch (e) {
    return ttsFailure(e);
  }
}
