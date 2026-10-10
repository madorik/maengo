import { runScheduler } from "@maengo/pipeline/scheduler";
import { after, NextResponse, type NextRequest } from "next/server";

// 5분마다 Supabase pg_cron이 부른다(supabase/migrations/…_scheduler_tasks.sql). 작업 표(scheduler_tasks)에서 차례가 된 것만 돌린다:
// 알림 시각 맹고 만들기·보내기(5분), 수집·임베딩·묶기·태그(30분), 요약(30분), Premium 기한 정리(하루).
// pg_net은 응답을 오래 기다리지 않으니 바로 202로 답하고 일은 after에서 한다.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  after(async () => {
    try {
      await runScheduler();
    } catch (e) {
      console.error("[scheduler] 실패", String((e as Error)?.message ?? e).slice(0, 300));
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
