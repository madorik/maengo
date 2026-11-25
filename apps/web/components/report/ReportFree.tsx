import Link from "next/link";
import type { ReportPeriod, ReportPreview } from "@maengo/core/report";
import { ReportBlock, ReportVerdict, ReportWeekStats } from "./ReportBody";

// Free가 보는 주간 리포트(2026-11-19 사용자: Free도 받되 본문 요약 정도만, 밑은 살짝 보이다 그라데이션과 함께 더 보기 → Premium).
// 위에서부터: 총평·숫자(전부) → 첫 칸의 제목과 본문 3~4줄(마지막 줄이 흐려지며 뒤 빈 줄로 이어짐) → Premium으로 더 보기 → 잠긴 칸 이름과 개수.
// 2026-11-21 사용자: 한 줄만 살짝 보여 궁금하지 않다 → 3~4줄까지 보여 준다. 예전엔 높이 210px에 160px 그라데이션이 본문을 거의 다 덮었다.
// 흐리게 가리는 건 화면이지만 내용은 애초에 서버가 앞부분만 보낸다(reportPreview, packages/core/src/report.ts): 개발자 도구로도 뒷부분은 없다
// 2026-11-25 6안: 총평은 연한 주황 상자, 맛보기는 회색 둥근 카드(가려지는 바탕도 카드색), 안내 카드는 회색 면에 주황 알약 버튼(왕관은 주황 버튼 위에서 안 보여 뺐다)

/** 가려진 뒷부분을 짐작하게 하는 빈 줄(글자 없음) */
const GHOST_WIDTHS = ["w-full", "w-11/12", "w-3/5"];

export function ReportFree({ period, preview }: { period: ReportPeriod; preview: ReportPreview }) {
  const { peek, locked } = preview;
  return (
    <div className="flex flex-col gap-8">
      <ReportVerdict headline={preview.headline} tones={preview.tones} />

      <ReportBlock title="나의 한 주">
        <ReportWeekStats period={period} counts={preview.counts} prev={preview.prev} />
      </ReportBlock>

      {peek && (
        <ReportBlock title={peek.label}>
          <article className="relative overflow-hidden rounded-2xl bg-snow px-4 pb-4 pt-4">
            <span className="inline-flex h-6 items-center rounded-full border border-line-dark px-2.5 text-[12px] font-semibold">{peek.about}</span>
            <h3 className="mt-2.5 text-[16px] font-extrabold leading-[1.45] tracking-[-0.03em]">{peek.title}</h3>
            <p className="mt-1.5 text-[15px] font-medium leading-[1.7] text-ink/80">{peek.text}</p>
            <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
              {GHOST_WIDTHS.map((w) => (
                <span key={w} className={`block h-3 rounded-full bg-line-dark/40 ${w}`} />
              ))}
            </div>
            {/* 빈 줄과 본문 마지막 줄만 카드색으로 덮는다(밝은·어두운 화면 모두 snow). 본문 앞쪽 3줄은 그대로 읽힌다 */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-snow via-snow/90 to-transparent" />
          </article>
        </ReportBlock>
      )}

      <section aria-labelledby="report-free-cta" className="rounded-[18px] bg-snow px-[18px] pb-[18px] pt-5">
        <h2 id="report-free-cta" className="text-[17px] font-extrabold leading-[1.45] tracking-[-0.03em]">
          Free는 총평과 숫자, 맛보기까지 보여요
        </h2>
        <p className="mt-1.5 text-[14px] font-medium leading-[1.6] text-ink/80">전부는 Premium에서 볼 수 있어요. 리포트는 보통 월요일 아침에 알려 드려요.</p>
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
        <Link href="/premium" className="btn mt-4 w-full">
          Premium으로 더 보기
        </Link>
      </section>
    </div>
  );
}
