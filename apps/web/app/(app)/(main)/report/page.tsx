import { addDays, kstDate, kstDayLabel } from "@maengo/core/kst";
import { periodEnd, reportPreview, reportTitle, weekStart, type ReportPeriod } from "@maengo/core/report";
import type { Metadata } from "next";
import Link from "next/link";
import { IconBack, IconChevronRight, IconTrendUp } from "@/components/icons";
import { ReportBody } from "@/components/report/ReportBody";
import { ReportFree } from "@/components/report/ReportFree";
import { MakeReport, ReportSeen } from "@/components/report/ReportClient";
import { ReportTeaser } from "@/components/report/ReportTeaser";
import { entitlements } from "@/lib/server/profile";
import { makeableStart, reportList, reportOf } from "@/lib/server/report";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "주간 리포트" };

/**
 * 주간 리포트(2026-11-10. 월간은 뺐다). ?d=그 주 월요일(없으면 가장 최근 리포트). 예전 알림 주소의 ?p=는 무시한다.
 * 리포트는 아침 작업(08:00 KST)이 만들어 두고, 다 끝난 지난 기간 리포트가 아직 없으면 '지금 만들기'로 바로 만든다.
 * Premium은 전체(ReportBody), Free는 총평·숫자와 맛보기까지(ReportFree, 2026-11-19 사용자: Free에게도 보내고 더 보기는 Premium으로).
 * Free는 서버에서 추린 요약(reportPreview)만 받는다. 아직 리포트가 없는 Free에게는 예시와 Premium 안내(ReportTeaser). 규칙은 맹고-문서/리포트.md
 * 2026-11-25 화면 개편(6안 리포트 모양만 먼저 적용, 사용자): 큰 제목 '주간 리포트' + Premium 알약 + 한 줄 설명, 총평은 연한 주황 상자(2026-11-26 사용자: 연노랑 다 제거 → 남색 상자),
 * 관심사·경제·나의 한 주는 회색 둥근 면. 주 고르기는 이전·다음 화살표를 알약 하나로 묶었다.
 * 2026-11-26 개편(사용자: 핵심 내용을 우선순위로 세워 읽기 쉽게, 승인한 새 구성): 머리는 제목·Premium 알약과 오른쪽 주 고르기('‹ 11월 셋째 주 ›'), 아래 날짜 범위 한 줄.
 * 본문 순서는 ReportBody 머리 주석. 리포트가 없을 때만 한 줄 설명을 둔다(리포트가 있으면 첫 상자가 그 역할).
 */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const premium = entitlements(profile).reports;
  const period: ReportPeriod = "week";

  return (
    <div className="mx-auto max-w-[640px] px-5 pb-6 pt-3.5 lg:pb-10 lg:pt-10">
      <WeeklyReport period={period} wanted={sp.d} premium={premium} />
    </div>
  );
}

async function WeeklyReport({ period, wanted, premium }: { period: ReportPeriod; wanted?: string; premium: boolean }) {
  const profile = await requireProfile();
  const today = kstDate();
  const list = await reportList(profile, period);
  const ready = list.filter((r) => r.status === "ready");
  const at = Math.max(0, wanted ? ready.findIndex((r) => r.start === wanted) : 0);
  const current = ready[at];
  const report = current ? await reportOf(profile, period, current.start) : null;
  // 다 끝난 지난 기간 리포트가 아직 없으면(아침 작업 전이거나 그 뒤에 가입·Premium이 됨) 지금 만들 수 있다
  const makeable = makeableStart(period, today);
  const canMake = !!makeable && !list.some((r) => r.start === makeable);
  const older = ready[at + 1];
  const newer = at > 0 ? ready[at - 1] : undefined;
  const href = (start: string) => `/report?d=${start}`;

  return (
    <>
      {/* 머리: 제목 + Premium 알약, 오른쪽에 주 고르기(좁은 화면에서는 줄이 바뀐다) */}
      <header className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-2">
        <h1 className="text-[24px] font-extrabold tracking-[-0.05em]">주간 리포트</h1>
        <span className="inline-flex h-[22px] items-center rounded-full bg-mango px-[9px] text-[11.5px] font-extrabold tracking-normal text-[#17181C]">Premium</span>
        {report && (
          <div className="ml-auto flex min-w-0 items-center rounded-full border border-line-dark">
            <Step to={older && href(older.start)} label="이전 리포트" dir="prev" />
            <span className="min-w-0 truncate px-0.5 text-center text-[13.5px] font-bold">{reportTitle(period, report.start, today)}</span>
            <Step to={newer && href(newer.start)} label="다음 리포트" dir="next" />
          </div>
        )}
      </header>
      {report ? (
        <p className="mt-1 text-[13.5px] font-medium text-sub">{rangeText(report.start)}</p>
      ) : (
        <p className="mt-1 text-[14px] font-medium leading-relaxed text-sub">지난주 소식이 관심사와 경제에 준 영향을 한 주마다 정리해요</p>
      )}

      {canMake && makeable && (
        <section aria-labelledby="report-make" className="mt-5 rounded-[22px] border border-line p-5">
          <p className="text-[13px] font-extrabold text-mango-deep">지난주 리포트</p>
          <h2 id="report-make" className="mt-1.5 text-[19px] font-extrabold leading-snug tracking-[-0.04em]">
            지난주 리포트를 지금 만들 수 있어요
          </h2>
          <p className="mt-1.5 text-[15px] font-medium leading-[1.55] text-ink/80">받은 소식을 관심사별로 묶어 한 장으로 정리해요</p>
          <div className="mt-4">
            <MakeReport period={period} label="지난주 리포트 만들기" />
          </div>
        </section>
      )}

      {report ? (
        <>
          <ReportSeen period={period} start={report.start} />
          <div className="mt-[18px]">
            {premium ? <ReportBody period={period} start={report.start} data={report.data} /> : <ReportFree period={period} preview={reportPreview(report.data)} />}
          </div>
        </>
      ) : (
        !canMake && (
          <>
            <div className="mt-6 flex items-center gap-3.5 rounded-[22px] border border-line p-5">
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mango text-[#17181C]">
                <IconTrendUp className="size-5" />
              </span>
              <p className="min-w-0 flex-1 text-[16px] font-bold leading-relaxed tracking-[-0.02em]">{emptyMessage(list[0]?.status === "empty", today)}</p>
            </div>
            {/* Free에게는 어떤 리포트가 오는지 예시와 Premium 안내도 */}
            {!premium && (
              <div className="mt-8">
                <ReportTeaser />
              </div>
            )}
          </>
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

/** '11월 17일 월요일부터 23일 일요일까지'(그 주 월~일. 달이 바뀌면 일요일 앞에도 달을 붙인다) */
function rangeText(start: string): string {
  const end = periodEnd("week", start);
  const month = (d: string) => Number(d.slice(5, 7));
  const day = (d: string) => Number(d.slice(8, 10));
  return `${month(start)}월 ${day(start)}일 월요일부터 ${month(end) === month(start) ? "" : `${month(end)}월 `}${day(end)}일 일요일까지`;
}

/** 이전·다음 주 화살표(알약 안 34px 둥근 버튼, 눌리는 자리는 ::before로 넓혔다). 갈 곳이 없으면 흐리게 */
function Step({ to, label, dir }: { to: string | undefined; label: string; dir: "prev" | "next" }) {
  const icon = dir === "prev" ? <IconBack className="size-4" /> : <IconChevronRight className="size-4" />;
  const box = "relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-full no-underline";
  return to ? (
    <Link href={to} aria-label={label} className={`${box} before:absolute before:-inset-1 before:content-[''] hover:bg-snow`}>
      {icon}
    </Link>
  ) : (
    <span aria-hidden="true" className={`${box} text-faint opacity-50`}>
      {icon}
    </span>
  );
}
