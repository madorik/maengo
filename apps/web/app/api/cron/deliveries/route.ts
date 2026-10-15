import { runDeliveryTick } from "@maengo/pipeline/deliveries";
import { after, NextResponse, type NextRequest } from "next/server";

// 1분마다 Supabase pg_cron이 부른다(supabase/migrations/…_deliveries_every_minute.sql).
// 알림 시각이 된 사람 중 오늘 소식을 아직 못 받은 사람에게만, 관심사에 맞는 소식을 골라(모자라면 석 달까지) 그때 요약해 지급하고 알린다.
// 수집·임베딩은 /api/cron/scheduler가 3시간마다 따로 한다. pg_net은 응답을 오래 기다리지 않으니 바로 202로 답한다.
// 요약이 많은 시각(여러 사람이 같은 시각)은 길어질 수 있어 300초까지 둔다(겹치지 않게 runDeliveryTick이 잠근다)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  after(async () => {
    try {
      await runDeliveryTick();
    } catch (e) {
      console.error("[deliveries] 실패", String((e as Error)?.message ?? e).slice(0, 300));
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
