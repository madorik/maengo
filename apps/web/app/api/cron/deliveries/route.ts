import { runDeliveries } from "@maengo/pipeline/deliveries";
import { after, NextResponse, type NextRequest } from "next/server";

// 5분마다 Supabase pg_cron이 부른다(supabase/migrations/…_deliveries_cron.sql). 스케줄 표(delivery_jobs)대로
// 알림 시각이 된 사람의 오늘 맹고를 만들고 FCM으로 보낸다. pg_net은 응답을 오래 기다리지 않으니 바로 202로 답하고 일은 after에서 한다.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  after(async () => {
    try {
      await runDeliveries();
    } catch (e) {
      console.error("[deliveries] 실패", String((e as Error)?.message ?? e).slice(0, 300));
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
