import { runScheduler } from "@maengo/pipeline/scheduler";
import * as Sentry from "@sentry/nextjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { billingConfigured, syncBilling } from "@/lib/server/billing";

// 5분마다 Supabase pg_cron이 부른다(supabase/migrations/…_scheduler_tasks.sql). 작업 표(scheduler_tasks)에서 차례가 된 것만 돌린다:
// 수집·임베딩·묶기·태그·중복 합치기(하루 한 번 06:00), Premium 기한 정리(하루). 요약은 미리 만들지 않고 알림 시각 배송이 그때 만든다(/api/cron/deliveries, 1분).
// pg_net은 응답을 오래 기다리지 않으니 바로 202로 답하고 일은 after에서 한다.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  after(async () => {
    try {
      // Premium 기한 정리 전에 RevenueCat에서 다시 읽는다(결제를 켰을 때만. 갱신 웹훅보다 먼저 돌아도 결제한 사람을 내리지 않게)
      await runScheduler(new Date(), {
        onTaskError: (task, e) => Sentry.captureException(e, { tags: { where: `scheduler:${task}` } }),
        ...(billingConfigured() ? { recheckPremium: async (id) => void (await syncBilling(id, "renewal_check")) } : {}),
      });
    } catch (e) {
      console.error("[scheduler] 실패", String((e as Error)?.message ?? e).slice(0, 300));
      Sentry.captureException(e, { tags: { where: "cron:scheduler" } });
    } finally {
      await Sentry.flush(2000);
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
