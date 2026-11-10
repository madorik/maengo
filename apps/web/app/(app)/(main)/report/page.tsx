import { addDays, kstDate, kstDayLabel } from "@maengo/core/kst";
import { reportRange, reportTitle, weekStart, type ReportPeriod } from "@maengo/core/report";
import type { Metadata } from "next";
import Link from "next/link";
import { IconBack, IconChevronRight } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { ReportBody } from "@/components/report/ReportBody";
import { MakeReport, ReportSeen } from "@/components/report/ReportClient";
import { ReportTeaser } from "@/components/report/ReportTeaser";
import { Bubble } from "@/components/ui/Bubble";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { entitlements } from "@/lib/server/profile";
import { makeableStart, reportList, reportOf } from "@/lib/server/report";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "주간 리포트" };

/**
 * 주간 리포트(2026-11-10, Premium. 월간은 뺐다). ?d=그 주 월요일(없으면 가장 최근 리포트). 예전 알림 주소의 ?p=는 무시한다.
 * 리포트는 아침 작업(08:00 KST)이 만들어 두고, 다 끝난 지난 기간 리포트가 아직 없으면 '지금 만들기'로 바로 만든다.
 * Free는 예시와 Premium 안내(ReportTeaser). 규칙은 맹고-문서/리포트.md
 */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const premium = entitlements(profile).reports;
  const period: ReportPeriod = "week";

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6 lg:py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-[28px] font-bold tracking-[-0.04em]">주간 리포트</h1>
        {!premium && <PremiumBadge className="mt-1" />}
      </div>
      {premium ? <PremiumReport period={period} wanted={sp.d} /> : <div className="mt-5"><ReportTeaser /></div>}
    </div>
  );
}

async function PremiumReport({ period, wanted }: { period: ReportPeriod; wanted?: string }) {
  const profile = await requireProfile();
  const today = kstDate();
  const list = await reportList(profile, period);
  const ready = list.filter((r) => r.status === "ready");
  const at = Math.max(0, wanted ? ready.findIndex((r) => r.start === wanted) : 0);
  const current = ready[at];
  const report = current ? await reportOf(profile, period, current.start) : null;
  // 다 끝난 지난 기간 리포트가 아직 없으면(아침 작업 전이거나 그 뒤에 Premium이 됨) 지금 만들 수 있다
  const makeable = makeableStart(period, today);
  const canMake = !!makeable && !list.some((r) => r.start === makeable);
  const older = ready[at + 1];
  const newer = at > 0 ? ready[at - 1] : undefined;
  const href = (start: string) => `/report?d=${start}`;

  return (
    <>
      {canMake && makeable && (
        <div className="tile mt-5 flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Mascot mood="cheer" className="size-14 shrink-0" />
            <p className="text-[17px] font-bold leading-snug tracking-[-0.02em]">지난주 리포트를 지금 만들 수 있어요</p>
          </div>
          <MakeReport period={period} label="지난주 리포트 만들기" />
        </div>
      )}

      {report ? (
        <>
          <ReportSeen period={period} start={report.start} />
          <div className="mt-5 flex items-center gap-2">
            <Step to={older && href(older.start)} label="이전 리포트" dir="prev" />
            <p className="min-w-0 flex-1 text-center">
              <span className="block truncate text-[18px] font-bold tracking-[-0.02em]">{reportTitle(period, report.start, today)}</span>
              <span className="block text-[13px] font-medium text-sub tabular-nums">{reportRange(period, report.start)}</span>
            </p>
            <Step to={newer && href(newer.start)} label="다음 리포트" dir="next" />
          </div>
          <div className="mt-4">
            <ReportBody period={period} data={report.data} />
          </div>
        </>
      ) : (
        !canMake && (
          <div className="mt-10 flex items-end gap-3">
            <Mascot className="size-24 shrink-0" />
            <Bubble className="mb-6 flex-1">
              <p className="text-[16px] font-bold leading-relaxed">{emptyMessage(list[0]?.status === "empty", today)}</p>
            </Bubble>
          </div>
        )
      )}
    </>
  );
}

/** 리포트가 하나도 없을 때. 지난주에 받은 소식이 적어 비웠으면 그렇게, 아니면 첫 리포트가 나오는 날(다음 월요일) */
function emptyMessage(lastEmpty: boolean, today: string): string {
  if (lastEmpty) return "지난주엔 받은 소식이 적어 리포트를 만들지 않았어요.";
  return `첫 주간 리포트는 ${kstDayLabel(addDays(weekStart(today), 7))} 아침에 나와요.`;
}

function Step({ to, label, dir }: { to: string | undefined; label: string; dir: "prev" | "next" }) {
  const icon = dir === "prev" ? <IconBack className="size-5" /> : <IconChevronRight className="size-5" />;
  const box = "tile inline-flex size-11 shrink-0 items-center justify-center no-underline";
  return to ? (
    <Link href={to} aria-label={label} className={`${box} hover:bg-snow`}>
      {icon}
    </Link>
  ) : (
    <span aria-hidden="true" className={`${box} text-faint opacity-50`}>
      {icon}
    </span>
  );
}
