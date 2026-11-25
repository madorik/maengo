import Link from "next/link";
import type { ReportPeriod, ReportPreview } from "@maengo/core/report";
import { ReportSection, ReportVerdict, ReportWeek, weekLead } from "./parts";

// Free가 보는 주간 리포트(2026-11-19 사용자: Free도 받되 본문 요약 정도만, 밑은 살짝 보이다 그라데이션과 함께 더 보기 → Premium).
// 2026-11-26 개편: Premium과 같은 순서·모양. 위에서부터: 지난주 한 줄 상자(총평과 관심사에 닿은 소식을 쪽마다 센 알약) → 나의 한 주(숫자 네 칸) →
// 첫 관심사의 제목과 본문 3~4줄(마지막 줄이 흐려지며 뒤 빈 줄로 이어짐) → Premium으로 더 보기 → 잠긴 칸 이름과 개수.
// 관심사별 판정 줄·이유는 Premium이라 서버가 내려보내지 않는다(reportPreview 그대로: 개수만 받는다). 요일별 막대도 Premium.
// 2026-11-21 사용자: 한 줄만 살짝 보여 궁금하지 않다 → 3~4줄까지 보여 준다. 예전엔 높이 210px에 160px 그라데이션이 본문을 거의 다 덮었다.
// 흐리게 가리는 건 화면이지만 내용은 애초에 서버가 앞부분만 보낸다(reportPreview, packages/core/src/report.ts): 개발자 도구로도 뒷부분은 없다

/** 가려진 뒷부분을 짐작하게 하는 빈 줄(글자 없음) */
const GHOST_WIDTHS = ["w-full", "w-11/12", "w-3/5"];

export function ReportFree({ period, preview }: { period: ReportPeriod; preview: ReportPreview }) {
  const { peek, locked } = preview;
  return (
    <div className="flex flex-col gap-11">
      <ReportVerdict headline={preview.headline} tones={preview.tones} />

      <ReportSection id="report-week" title="나의 한 주" lead={weekLead(preview.counts)}>
        <ReportWeek period={period} counts={preview.counts} prev={preview.prev} />
      </ReportSection>

      {peek && (
        <ReportSection id="report-peek" title={peek.label} lead={peek.label === "분야별로 보면" ? "첫 분야의 앞부분만 보여 드려요" : "첫 관심사의 앞부분만 보여 드려요"}>
          <article className="relative mt-3.5 overflow-hidden rounded-[22px] border border-line px-5 pb-5 pt-[22px]">
            <span className="inline-flex h-[26px] items-center rounded-full bg-snow px-2.5 text-[12.5px] font-bold">{peek.about}</span>
            <h3 className="mt-2.5 text-[19px] font-extrabold leading-[1.45] tracking-[-0.04em] text-balance">{peek.title}</h3>
            <p className="mt-2 text-[15px] font-medium leading-[1.7] text-ink/80">{peek.text}</p>
            <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
              {GHOST_WIDTHS.map((w) => (
                <span key={w} className={`block h-3 rounded-full bg-line ${w}`} />
              ))}
            </div>
            {/* 빈 줄과 본문 마지막 줄만 바탕색으로 덮는다(밝은·어두운 화면 모두 paper). 본문 앞쪽 3줄은 그대로 읽힌다 */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper via-paper/90 to-transparent" />
          </article>
        </ReportSection>
      )}

      <section aria-labelledby="report-free-cta" className="rounded-[22px] bg-snow px-5 pb-5 pt-[22px]">
        <h2 id="report-free-cta" className="text-[19px] font-extrabold leading-[1.45] tracking-[-0.04em]">
          Free는 총평과 숫자, 맛보기까지 보여요
        </h2>
        <p className="mt-1.5 text-[15px] font-medium leading-[1.6] text-ink/80">전부는 Premium에서 볼 수 있어요. 리포트는 보통 월요일 아침에 알려 드려요.</p>
        {locked.length > 0 && (
          <>
            <p className="mt-4 text-[13px] font-bold text-sub">Premium에서 이어서 볼 수 있어요</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {locked.map((l) => (
                <li key={l.label} className="inline-flex h-8 items-center rounded-full bg-paper px-3 text-[13px] font-semibold">
                  {l.count ? `${l.label} ${l.count}개` : l.label}
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/premium" className="btn mt-5 w-full">
          Premium으로 더 보기
        </Link>
      </section>
    </div>
  );
}
