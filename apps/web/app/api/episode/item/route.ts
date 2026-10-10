import { NextResponse, type NextRequest } from "next/server";
import { getItemEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { ttsFailure } from "@/lib/server/file-response";
import { parseEpisodeParams } from "../params";


/**
 * GET ?id=203&persona=teacher&voice=f → 소식 하나짜리 에피소드의 대본 시각표(문단 표시용).
 * 음성은 만들지 않는다(만드는 건 파일 요청 하나만. 둘 다 만들면 서버가 달라 같은 음성을 두 번 만든다).
 * 파일이 열린 뒤(loadedmetadata) 부르면 실제 시각표, 그 전이면 어림값이다.
 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!entitlements(profile).audio) return NextResponse.json({ error: "plus_required" }, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!params || !Number.isInteger(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let episode;
  try {
    episode = await getItemEpisode(profile, id, params.persona, params.voice, { generate: false });
  } catch (e) {
    return ttsFailure(e);
  }
  if (!episode) return NextResponse.json({ error: "not_in_feed" }, { status: 404 });
  return NextResponse.json({ durationMs: episode.durationMs, chapter: episode.chapters[0] }, { headers: { "cache-control": "no-store" } });
}
