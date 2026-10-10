import { buildTodayFeedNow, type InstantProgress } from "@maengo/pipeline/instant";
import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/session";

// "오늘 맹고 받기": 오늘 피드가 비었을 때 이 사람 것을 지금 만든다. 진행 상황을 한 줄에 하나씩(NDJSON) 흘려보낸다.
// 요약이 필요하면 소식당 10~20초, 최대 5개라 1분 안쪽이다. 고를 소식이 없으면 최근 글 처리(수집·임베딩·묶기·태그)가 1~2분 더 걸린다.
export const maxDuration = 300;

const running = new Set<string>();

export async function POST() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!profile.onboarded) return NextResponse.json({ error: "not_onboarded" }, { status: 400 });
  if (running.has(profile.id)) return NextResponse.json({ error: "already_running" }, { status: 409 });
  running.add(profile.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 브라우저가 연결을 끊어도 만들기는 끝까지 한다(진행 알림을 못 보내는 것만 무시)
      const send = (p: InstantProgress | { stage: "error" }) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(p)}\n`));
        } catch {}
      };
      try {
        await buildTodayFeedNow(profile.id, send, { maxSummaries: Math.min(5, profile.plan === "free" ? 1 : 5) });
      } catch (e) {
        console.error("[instant] 실패", String((e as Error)?.message ?? e).slice(0, 300));
        send({ stage: "error" });
      } finally {
        running.delete(profile.id);
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
