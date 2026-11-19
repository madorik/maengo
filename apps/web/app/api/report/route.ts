import { isReportPeriod } from "@maengo/core/report";
import { buildReport, ReportAiBlocked } from "@maengo/pipeline/reports";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { makeableStart } from "@/lib/server/report";
import { currentProfile } from "@/lib/server/session";

// 리포트 '지금 만들기'(2026-11-10): 다 끝난 지난 기간(지난주, 1~7일이면 지난달) 리포트가 아직 없을 때 그 자리에서 만든다.
// 아침 작업(08:00 KST)보다 먼저 연 사람, 그 뒤에 가입·Premium이 된 사람이 바로 볼 수 있게. 푸시는 보내지 않는다.
// 2026-11-19부터 Free도 만들 수 있다(Free는 요약과 맛보기까지만 보인다. 보이는 범위는 화면이 정한다).
// 기간마다 한 번만 만든다(이미 있거나 받은 소식이 적어 비운 기간은 그대로). 정리는 Gemini 한 번이라 보통 5초 안팎.
export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { period?: unknown } | null;
  const period = body?.period;
  if (!isReportPeriod(period)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const start = makeableStart(period);
  if (!start) return NextResponse.json({ error: "not_due" }, { status: 409 });
  try {
    const r = await buildReport(profile.id, period, start);
    return NextResponse.json({ status: r.status, period, start });
  } catch (e) {
    if (e instanceof ReportAiBlocked) return NextResponse.json({ error: "blocked" }, { status: 503 });
    Sentry.captureException(e);
    console.error("[report] 만들기 실패", String((e as Error).message ?? e).slice(0, 200));
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
