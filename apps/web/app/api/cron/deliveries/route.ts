import { runDeliveryTick } from "@maengo/pipeline/deliveries";
import * as Sentry from "@sentry/nextjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { prewarmInsights } from "@/lib/server/insight-prewarm";

// 1분마다 Supabase pg_cron이 부른다(supabase/migrations/…_deliveries_every_minute.sql).
// 알림 시각이 된 사람 중 오늘 소식을 아직 못 받은 사람에게만, 관심사에 맞는 소식을 골라(모자라면 석 달까지) 그때 요약해 지급하고 알린다.
// 수집·임베딩은 /api/cron/scheduler가 하루 한 번(06:00) 따로 한다. pg_net은 응답을 오래 기다리지 않으니 바로 202로 답한다.
// 요약이 많은 시각(여러 사람이 같은 시각)은 길어질 수 있어 300초까지 둔다(겹치지 않게 runDeliveryTick이 잠근다)
export const maxDuration = 300;

const DELIVERIES_MONITOR = {
  schedule: { type: "crontab" as const, value: "* * * * *" },
  checkinMargin: 5,
  maxRuntime: 6,
  failureIssueThreshold: 3,
  recoveryThreshold: 1,
  timezone: "Asia/Seoul",
};

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Sentry Crons: 5분 넘게 틱이 안 오거나 연달아 실패하면 알림이 온다(pg_cron·pg_net·rewrite가 깨져도 알 수 있게)
  const started = Date.now();
  after(async () => {
    try {
      const result = await Sentry.withMonitor("deliveries", () => runDeliveryTick(), DELIVERIES_MONITOR);
      if (result !== "busy" && result.failed > 0) Sentry.captureMessage("배송 실패가 있어요", { level: "warning", extra: { ...result } });
      // 오늘 브리핑을 받은 사람(최근 3일 안에 온 사람만)의 오늘의 흐름을 미리 만든다(열면 바로 보이게, lib/server/insight-prewarm.ts). 남은 시간 안에서만
      if (result !== "busy") await prewarmInsights(started + 270_000).catch((e) => console.error("[insight-prewarm] 실패", String((e as Error)?.message ?? e).slice(0, 200)));
    } catch (e) {
      console.error("[deliveries] 실패", String((e as Error)?.message ?? e).slice(0, 300));
      Sentry.captureException(e, { tags: { where: "cron:deliveries" } });
    } finally {
      await Sentry.flush(2000);
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
