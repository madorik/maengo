import { NextResponse, type NextRequest } from "next/server";
import { getItemEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { ttsFailure } from "@/lib/server/file-response";
import { parseEpisodeParams } from "../params";

/** GET ?id=203&persona=teacher&voice=f → 소식 하나짜리 에피소드의 대본 시각표(문단 표시용). 재생을 누를 때만 부르고, 음성 파일 요청과 같은 생성을 기다린다 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!entitlements(profile).audio) return NextResponse.json({ error: "plus_required" }, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!params || !Number.isInteger(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let episode;
  try {
    episode = await getItemEpisode(profile, id, params.persona, params.voice, { generate: true });
  } catch (e) {
    return ttsFailure(e);
  }
  if (!episode) return NextResponse.json({ error: "not_in_feed" }, { status: 404 });
  return NextResponse.json({ durationMs: episode.durationMs, chapter: episode.chapters[0] }, { headers: { "cache-control": "no-store" } });
}
