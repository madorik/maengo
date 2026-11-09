import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { getEpisode } from "@/lib/server/episode";
import { currentProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { withBase } from "@/lib/base-path";
import type { EpisodeData } from "@/lib/types";
import { parseEpisodeParams, parseTodayIds } from "../params";

/**
 * GET ?voice=f&ids=3,1,2 → 오늘 에피소드의 파일 주소와 챕터 표. 음성을 만들지 않는다(만드는 건 audioUrl을 열 때).
 * ids는 화면에 보이는 오늘 소식이다. 그 소식만 넣어 화면 목록과 플레이어 목록·길이가 같게 한다.
 * Free도 오늘 듣기 몫(plans.daily_listens)이 있으면 받는다(2026-11-09, 전체 듣기를 하루 몫 안에서). Free는 이어 붙인 전체 파일(/api/episode/audio)을
 * 쓰지 않고 늘 소식 하나씩 듣는다(ready: false). 한 소식씩 파일을 열 때 몫을 센다(/api/episode/item/audio)
 */
export async function GET(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { audio, dailyListens } = entitlements(profile);
  if (!audio && dailyListens <= 0) return NextResponse.json({ error: "plus_required" }, { status: 403 });
  const params = parseEpisodeParams(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const date = kstDate();
  const ids = parseTodayIds(request.nextUrl.searchParams.get("ids"));
  const episode = await getEpisode(profile, date, params.persona, params.voice, { generate: false, ids });
  // 파일 주소에 챕터 구성을 넣는다: 파일도 이 소식들로 만들고, 피드가 바뀌면 브라우저 캐시도 새로 받는다. 음성을 만들기 전후로 주소가 같아야 한다
  const chapterIds = episode.chapters.map((c) => c.clusterId).join(",");
  const body: EpisodeData = {
    date,
    persona: params.persona,
    voice: params.voice,
    audioUrl: withBase(`/api/episode/audio?date=${date}&persona=${params.persona}&voice=${params.voice}&ids=${chapterIds}`),
    ready: audio && episode.objectKey !== null,
    durationMs: episode.durationMs,
    chapters: episode.chapters,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
