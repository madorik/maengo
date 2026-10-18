import { buildTodayFeedNow, type InstantProgress } from "@maengo/pipeline/instant";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { restoreTodayExtra, todayForRebuild, waitingForDelivery } from "@/lib/server/feed";
import { lockInstant, unlockInstant } from "@/lib/server/instant-lock";
import { recordUse, usesToday } from "@/lib/server/limits";
import { entitlements } from "@/lib/server/profile";
import { currentProfile } from "@/lib/server/session";

// "오늘 소식 받기": 오늘 화면이 비었을 때(처음·알림 시각 전·배송이 못 만든 날·보일 소식이 없어진 날) 이 사람 것을 지금 만든다. 진행 상황을 한 줄에 하나씩(NDJSON) 흘려보낸다.
// 요약이 필요하면 소식당 10~20초, 최대 5개라 1분 안쪽이다. 고를 소식이 없으면 최근 글 처리(수집·임베딩·묶기·태그)가 1~2분 더 걸린다.
// 만들기(buildTodayFeedNow)는 오늘 피드를 지우고 다시 만들어서, 오늘 화면에 보일 소식이 있으면 막는다(읽고 다시 눌러 새 소식을 공짜로 받지 않게).
// 줄은 있어도 보일 소식이 없으면(묶음이 합쳐지거나 지워짐) 다시 만든다. 맹고로 더 받은 개수(extra)는 다시 만들어도 지킨다.
// 한 사람에 하나씩(DB 잠금, lib/server/instant-lock.ts. 잠금이 살아 있는 동안 오늘 화면은 '만드는 중'), 하루 DAILY_CAP번까지.
// maxDuration을 바꾸면 instant-lock.ts의 INSTANT_LOCK_STALE_MS도 같이 바꾼다.
export const maxDuration = 300;

/** 한 사람이 하루에 부를 수 있는 횟수. 소식이 없었거나 AI가 막혀 다시 누르는 경우만 여러 번 온다(부를 때마다 요약·임베딩 비용) */
const DAILY_CAP = 5;

export async function POST() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!profile.onboarded) return NextResponse.json({ error: "not_onboarded" }, { status: 400 });
  // 하루 소식은 알림 시각에 배송이 지급하고, 그 전에는 여기서 먼저 받을 수 있다. 배송이 만들 때(알림 6분 전 ~ 10분 뒤)만 기다린다
  if (await waitingForDelivery(profile)) return NextResponse.json({ error: "scheduled" }, { status: 409 });
  const token = await lockInstant(profile.id);
  if (!token) return NextResponse.json({ error: "already_running" }, { status: 409 });
  let today: Awaited<ReturnType<typeof todayForRebuild>>;
  try {
    // 잠근 뒤에 본다(먼저 본 뒤 잠그면 그사이 끝난 다른 요청의 피드를 다시 지울 수 있다)
    today = await todayForRebuild(profile);
    if (today.hasItems) {
      await unlockInstant(profile.id, token);
      return NextResponse.json({ error: "already_built" }, { status: 409 });
    }
    if ((await usesToday(profile.id, "instant")) >= DAILY_CAP) {
      await unlockInstant(profile.id, token);
      return NextResponse.json({ error: "daily_cap" }, { status: 429 });
    }
    await recordUse(profile.id, "instant");
  } catch (e) {
    await unlockInstant(profile.id, token);
    throw e;
  }

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
        // 하루 맹고만큼 새로 요약한다(Free 3, Premium은 시간 때문에 5까지. 모자란 건 오늘 화면을 열 때 채운다)
        await buildTodayFeedNow(profile.id, send, { maxSummaries: Math.min(5, entitlements(profile).dailyItems) });
      } catch (e) {
        console.error("[instant] 실패", String((e as Error)?.message ?? e).slice(0, 300));
        Sentry.captureException(e, { tags: { where: "instant" } });
        send({ stage: "error" });
      } finally {
        // 소식 없이 끝났거나 실패해 그날 행이 지워졌으면 맹고로 더 받은 개수를 되살린다(잘 만들어졌으면 그대로)
        await restoreTodayExtra(profile.id, today.date, today.extra);
        await unlockInstant(profile.id, token);
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
