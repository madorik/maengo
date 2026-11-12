import { fillTodayFeedNow, type InstantProgress } from "@maengo/pipeline/instant";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { todayFillStatus, waitingForDelivery } from "@/lib/server/feed";
import { lockInstant, unlockInstant } from "@/lib/server/instant-lock";
import { recordUse, usesToday } from "@/lib/server/limits";
import { currentProfile } from "@/lib/server/session";
import { MORE_MAX, MORE_STEP } from "@/lib/more";

// "남은 소식 더 받기": 지금 브리핑(출근길·퇴근길)에 받은 소식이 하루 소식보다 적을 때(배송이 적게 준 날) 모자란 만큼 지금 채운다(2026-10-20 사용자 결정, 2026-11-12 브리핑별로).
// 하루 소식 안이라 맹고를 쓰지 않는다. 오늘 받은 소식은 그대로 두고 뒤에 붙인다. 진행 상황을 한 줄에 하나씩(NDJSON) 흘려보낸다(api/feed/today와 같은 모양).
// 요약은 소식당 10~20초, 동시에 3개라 Premium 7개도 1분 안쪽이다. '오늘 소식 받기'와 같은 잠금(한 사람에 하나씩), 하루 DAILY_CAP번까지.
// maxDuration을 바꾸면 instant-lock.ts의 INSTANT_LOCK_STALE_MS도 같이 본다(같은 300초).
export const maxDuration = 300;

/** 한 사람이 하루에 부를 수 있는 횟수(부를 때마다 요약 비용) */
const DAILY_CAP = 3;

// '더 보기'(body {more: true}, lib/more.ts): 뉴스는 하루 이틀이면 지나서 최근 48시간 소식에서만 고른다
/** 후보 기간(시간) */
const MORE_WINDOW_HOURS = 48;
/** 하루에 부를 수 있는 횟수(브리핑 두 번 × 3번, 끊겨서 다시 누르는 몫 조금) */
const MORE_DAILY_CAP = 8;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { more?: unknown };
  const more = body.more === true;
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!profile.onboarded) return NextResponse.json({ error: "not_onboarded" }, { status: 400 });
  // 배송이 만들 때(알림 6분 전 ~ 10분 뒤)는 기다린다
  if (await waitingForDelivery(profile)) return NextResponse.json({ error: "scheduled" }, { status: 409 });
  const token = await lockInstant(profile.id);
  if (!token) return NextResponse.json({ error: "already_running" }, { status: 409 });
  let want: number;
  let slot: "am" | "pm";
  try {
    // 잠근 뒤에 본다(todayFeed가 이미 요약된 소식으로 먼저 채운다)
    const today = await todayFillStatus(profile);
    if (!today.hasFeed) {
      await unlockInstant(profile.id, token);
      return NextResponse.json({ error: "no_feed" }, { status: 409 });
    }
    if (more) {
      // 브리핑을 다 받은 뒤에만. 30개를 다 더 봤으면 끝
      const cap = today.want + MORE_MAX;
      if (today.shown >= cap) {
        await unlockInstant(profile.id, token);
        return NextResponse.json({ error: "more_done" }, { status: 409 });
      }
      if ((await usesToday(profile.id, "more")) >= MORE_DAILY_CAP) {
        await unlockInstant(profile.id, token);
        return NextResponse.json({ error: "daily_cap" }, { status: 429 });
      }
      await recordUse(profile.id, "more");
      want = Math.min(Math.max(today.shown, today.want) + MORE_STEP, cap);
    } else {
      if (today.shown >= today.want) {
        await unlockInstant(profile.id, token);
        return NextResponse.json({ error: "nothing_left" }, { status: 409 });
      }
      if ((await usesToday(profile.id, "fill")) >= DAILY_CAP) {
        await unlockInstant(profile.id, token);
        return NextResponse.json({ error: "daily_cap" }, { status: 429 });
      }
      await recordUse(profile.id, "fill");
      want = today.want;
    }
    slot = today.slot;
  } catch (e) {
    await unlockInstant(profile.id, token);
    throw e;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 브라우저가 연결을 끊어도 끝까지 채운다(진행 알림을 못 보내는 것만 무시)
      const send = (p: InstantProgress | { stage: "error" }) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(p)}\n`));
        } catch {}
      };
      try {
        await fillTodayFeedNow(profile.id, want, send, slot, more ? MORE_WINDOW_HOURS : undefined);
      } catch (e) {
        console.error("[fill] 실패", String((e as Error)?.message ?? e).slice(0, 300));
        Sentry.captureException(e, { tags: { where: "fill" } });
        send({ stage: "error" });
      } finally {
        await unlockInstant(profile.id, token);
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
