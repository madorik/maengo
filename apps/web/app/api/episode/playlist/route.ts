import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { estimateItems, getPlaylistEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { parsePlaylistIds, playlistAudioUrl } from "@/lib/playlist";
import type { EpisodeData } from "@/lib/types";
import { parseEpisodeParams } from "../params";

/** GET ?ids=3,1,2&voice=f → 보관함 플레이리스트의 파일 주소와 챕터 표(Premium). 음성을 만들지 않는다(만드는 건 audioUrl을 열 때) */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!entitlements(profile).audio) return NextResponse.json({ error: "plus_required" }, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  const ids = parsePlaylistIds(request.nextUrl.searchParams.get("ids"));
  if (!params || !ids) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { items, episode } = await getPlaylistEpisode(profile, ids, params.persona, params.voice, { generate: false });
  const body: EpisodeData = {
    date: kstDate(),
    persona: params.persona,
    voice: params.voice,
    // 화면이 재생을 누를 때 만든 주소와 같아야 한다(같으면 파일을 다시 걸지 않는다)
    audioUrl: playlistAudioUrl(ids, params.voice),
    ready: episode.objectKey !== null,
    durationMs: episode.durationMs,
    chapters: episode.chapters,
    estimates: estimateItems(items),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
