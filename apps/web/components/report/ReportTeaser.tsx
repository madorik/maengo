import Link from "next/link";
import type { ReportTone } from "@maengo/core/report";
import { VerdictFrame, VerdictPill } from "./parts";

// Free가 리포트 메뉴를 열면: 어떤 리포트인지 예시 한 장과 Premium 안내(요금 페이지로). 예시 숫자·문구는 지어낸 것이라 '예시'로 표시한다
// 2026-11-26 개편: 실제 리포트와 같은 우선순위 — 남색 '지난주 한 줄' 상자(총평 + 관심사별 판정 줄), 그 아래 챙겨 볼 일정 한 줄, 키워드 칩. 숫자 칸·막대는 뺐다

const SAMPLE = {
  headline: "외국인 매도로 국내 주식엔 부담, 반도체엔 기회였던 한 주",
  verdicts: [
    ["국내 주식", "외국인 닷새 매도에 코스피 3.1% 하락", "minus"],
    ["반도체", "HBM 일정 앞당겨, 업종 4.2% 상승", "plus"],
    ["대출 이자", "금리 인하가 늦어질 수 있어요", "watch"],
  ] as readonly (readonly [string, string, ReportTone])[],
  schedule: { month: 11, day: 26, weekday: "목", title: "엔비디아 실적 발표", about: "국내 주식, 반도체" },
  keywords: ["외국인 매도", "HBM", "주담대"],
};

export function ReportTeaser() {
  return (
    <div>
      <ul className="flex flex-col gap-2 text-[16px] font-bold leading-relaxed">
        <li>매주 월요일 아침, 지난주 받은 소식을 관심사별로 정리하고 한 줄로 판정해 드려요</li>
        <li className="text-sub">한 줄 총평과 나의 한 주 숫자는 Free에서도 보여 드려요. 관심사별 자세히, 챙겨 볼 일정, 지난주 시장, 놓친 주요 소식은 Premium에서 한 장에</li>
      </ul>

      {/* 예시. 화면 읽기 프로그램에는 숨기고 위 설명으로 대신한다 */}
      <div aria-hidden="true" className="relative mt-7 select-none">
        <span className="absolute -top-3 left-4 z-10 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">예시</span>
        <VerdictFrame headline={SAMPLE.headline} lines>
          <ul className="mt-4">
            {SAMPLE.verdicts.map(([about, title, tone]) => (
              <li key={about} className="flex items-center gap-2.5 border-t border-white/12 py-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold leading-[1.35] tracking-[-0.03em]">{about}</span>
                  <span className="mt-0.5 block text-[14px] font-medium leading-[1.45] text-white/72">{title}</span>
                </span>
                <VerdictPill tone={tone} />
              </li>
            ))}
          </ul>
        </VerdictFrame>

        <div className="mt-6 flex gap-3.5">
          <span className="flex h-[58px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-snow">
            <span className="text-[11px] font-semibold leading-tight text-sub">{`${SAMPLE.schedule.month}월`}</span>
            <span className="text-[20px] font-extrabold leading-[1.15] tabular-nums">{SAMPLE.schedule.day}</span>
            <span className="text-[11px] font-semibold leading-tight text-sub">{SAMPLE.schedule.weekday}</span>
          </span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block text-[16px] font-bold leading-[1.4] tracking-[-0.02em]">{SAMPLE.schedule.title}</span>
            <span className="mt-1 block text-[12.5px] font-bold text-mango-deep">{SAMPLE.schedule.about}</span>
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SAMPLE.keywords.map((k) => (
            <span key={k} className="inline-flex h-9 items-center rounded-full border border-line-dark px-3.5 text-[14px] font-bold">
              {k}
            </span>
          ))}
        </div>
      </div>

      <Link href="/premium" className="btn mt-8 w-full">
        Premium으로 받기
      </Link>
    </div>
  );
}
