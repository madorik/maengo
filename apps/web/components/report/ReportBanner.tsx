import { reportPushTitle } from "@maengo/core/report";
import { freshReport } from "@/lib/server/report";
import { requireProfile } from "@/lib/server/session";
import { ReportToast } from "./ReportToast";

/**
 * 오늘 화면: 아직 안 연 리포트가 나왔으면(이레 안, Premium) 아래쪽 알림으로 알린다(ReportToast).
 * 2026-11-11까지는 맨 위 카드였다(자리를 먹어 다른 카드가 밀린다는 사용자 의견으로 바꿈). 리포트를 열면 사라진다
 */
export async function ReportBanner() {
  const profile = await requireProfile();
  const r = await freshReport(profile).catch(() => null);
  if (!r) return null;
  return <ReportToast start={r.start} title={reportPushTitle(r.period, r.start)} headline={r.headline} />;
}
