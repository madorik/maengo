import Link from "next/link";
import type { ReportPeriod, ReportPreview } from "@maengo/core/report";
import { Crown } from "@/components/icons";
import { ReportHero } from "./ReportBody";

// Free가 보는 주간 리포트(2026-11-19 사용자: Free도 받되 본문 요약 정도만, 밑은 살짝 보이다 그라데이션과 함께 더 보기 → Premium).
// 위에서부터: 총평·숫자(전부) → 첫 칸의 앞부분이 그라데이션으로 흐려지고 → Premium으로 더 보기 → 잠긴 칸 이름과 개수.
// 흐리게 가리는 건 화면이지만 내용은 애초에 서버가 앞부분만 보낸다(reportPreview, packages/core/src/report.ts): 개발자 도구로도 뒷부분은 없다

/** 가려진 뒷부분을 짐작하게 하는 빈 줄(글자 없음) */
const GHOST_WIDTHS = ["w-full", "w-11/12", "w-3/5"];

export function ReportFree({ period, preview }: { period: ReportPeriod; preview: ReportPreview }) {
  const { peek, locked } = preview;
  return (
    <div className="flex flex-col gap-5">
      <ReportHero period={period} headline={preview.headline} counts={preview.counts} prev={preview.prev} />

      <section aria-label="Premium에서 더 보기">
        {peek && (
          <div className="relative">
            <div className="max-h-[210px] overflow-hidden">
              <h2 className="text-[17px] font-bold tracking-[-0.02em]">{peek.label}</h2>
              <article className="py-3.5">
                <span className="block text-[12px] font-semibold text-mango-deep">{peek.about}</span>
                <h3 className="mt-1 text-[16px] font-bold leading-snug tracking-[-0.02em]">{peek.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-sub">{peek.text}</p>
                <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
                  {GHOST_WIDTHS.map((w) => (
                    <span key={w} className={`block h-3 rounded-full bg-line ${w}`} />
                  ))}
                </div>
              </article>
              <div aria-hidden="true" className="flex flex-col gap-2 py-3.5">
                <span className="block h-3 w-1/4 rounded-full bg-line" />
                <span className="block h-4 w-3/4 rounded-full bg-line" />
                <span className="block h-3 w-full rounded-full bg-line" />
              </div>
            </div>
            {/* 아래로 갈수록 바탕색으로 덮는다(밝은·어두운 화면 모두 paper) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper via-paper/90 to-transparent" />
          </div>
        )}

        {/* 버튼은 흐려지는 자리에 걸쳐 놓는다(내용이 버튼으로 이어지는 모양) */}
        <div className={peek ? "relative -mt-14" : ""}>
          <Link href="/premium" className="btn w-full">
            <Crown className="size-5" />
            Premium으로 더 보기
          </Link>
          {locked.length > 0 && (
            <>
              <p className="mt-5 text-[13px] font-bold text-sub">Premium에서 이어서 볼 수 있어요</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {locked.map((l) => (
                  <li key={l.label} className="rounded-full bg-snow px-3 py-1.5 text-[13px] font-semibold">
                    {l.count ? `${l.label} ${l.count}개` : l.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
