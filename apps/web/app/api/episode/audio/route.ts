import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { episodeFileUrl, getEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { redirectToFile, ttsFailure } from "@/lib/server/file-response";
import { parseEpisodeParams } from "../params";

// 오늘 에피소드 파일. 아직 없는 소식의 음성은 이 요청에서 만들고(소식당 수십 초), 다 되면 저장소(R2 서명 URL)로 넘긴다.
// <audio>는 넘겨받은 주소에서 Range 요청으로 바로 받는다.
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return new NextResponse(null, { status: 401 });
  if (!entitlements(profile).audio) return new NextResponse(null, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  if (!params) return new NextResponse(null, { status: 400 });
  const date = request.nextUrl.searchParams.get("date") ?? kstDate();
  if (date !== kstDate()) return new NextResponse(null, { status: 404 });

  try {
    const url = await episodeFileUrl(await getEpisode(profile, date, params.persona, params.voice, { generate: true }));
    if (!url) return new NextResponse(null, { status: 404 });
    return redirectToFile(request, url);
  } catch (e) {
    return ttsFailure(e);
  }
}
