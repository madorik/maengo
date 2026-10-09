import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { estimateDurations, getEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/store";
import type { EpisodeData } from "@/lib/types";
import { parseEpisodeParams } from "../params";

/** GET ?persona=teacher&voice=f → 오늘 에피소드의 파일 주소와 챕터 표 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!entitlements(profile).audio) return NextResponse.json({ error: "plus_required" }, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const date = kstDate();
  const episode = await getEpisode(profile, date, params.persona, params.voice);
  // 파일 주소에 챕터 구성을 넣어 피드가 바뀌면 브라우저 캐시도 새로 받게 한다
  const version = episode.chapters.map((c) => c.clusterId).join("-");
  const body: EpisodeData = {
    date,
    persona: params.persona,
    voice: params.voice,
    audioUrl: `/api/episode/audio?date=${date}&persona=${params.persona}&voice=${params.voice}&v=${version}-${episode.durationMs}`,
    durationMs: episode.durationMs,
    chapters: episode.chapters,
    estimates: await estimateDurations(profile, date),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
