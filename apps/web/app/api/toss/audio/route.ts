import { NextResponse, type NextRequest } from "next/server";
import { episodeFileUrl, getPublicItemEpisode } from "@/lib/server/episode";
import { redirectToFile, ttsFailure } from "@/lib/server/file-response";
import { TOSS_CORS, tossAudioItem } from "@/lib/server/toss";

// 처음 듣는 소식은 이 요청에서 음성을 만든다(소식당 수십 초)
export const maxDuration = 300;

// 토스 미니앱의 소식 음성(여성 목소리). 이미 만든 음성(Premium·기본)을 먼저 쓰고, 없으면 기본 음성을 한 번 만들어 모두가 같이 쓴다.
// 최근 소식만 만든다(lib/server/toss.ts tossAudioItem). <audio>가 바로 여는 주소라 저장소 파일로 넘긴다
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 400 });
  const item = await tossAudioItem(id);
  if (!item) return new NextResponse(null, { status: 404 });
  try {
    const episode = await getPublicItemEpisode(item, "f", { generate: true });
    // warm=1: 이어 듣기가 다음 소식 음성을 미리 만들어 둔다(파일 주소 없이 204)
    if (request.nextUrl.searchParams.get("warm") === "1") return new NextResponse(null, { status: 204, headers: TOSS_CORS });
    const url = await episodeFileUrl(episode);
    if (!url) return new NextResponse(null, { status: 404 });
    return redirectToFile(request, url);
  } catch (e) {
    return ttsFailure(e);
  }
}
