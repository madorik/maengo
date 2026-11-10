import Link from "next/link";
import { Crown } from "@/components/icons";

// Free가 리포트 메뉴를 열면: 어떤 리포트인지 예시 한 장과 Premium 안내(요금 페이지로). 예시 숫자·문구는 지어낸 것이라 '예시'로 표시한다

const SAMPLE = {
  headline: "엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요",
  stats: [
    ["받은 소식", 70],
    ["본 소식", 41],
    ["들은 소식", 18],
    ["북마크", 3],
  ] as const,
  bars: [
    ["AI", 14, 20],
    ["반도체·로봇", 12, 15],
    ["주식", 9, 18],
  ] as const,
  keywords: ["HBM4", "AI 에이전트", "사이드카"],
};

export function ReportTeaser() {
  return (
    <div>
      <ul className="flex flex-col gap-2 text-[16px] font-bold leading-relaxed">
        <li>매주 월요일·매달 1일 아침, 받은 소식을 정리해 드려요</li>
        <li className="text-sub">한 줄 총평과 분야별 정리, 많이 본 분야, 자주 나온 키워드, 놓친 주요 소식까지 한 장에</li>
      </ul>

      {/* 예시. 화면 읽기 프로그램에는 숨기고 위 설명으로 대신한다 */}
      <div aria-hidden="true" className="relative mt-6 select-none">
        <span className="absolute -top-3 left-4 z-10 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">예시</span>
        <div className="keep-light rounded-2xl bg-mango px-5 pb-5 pt-6 shadow-[0_4px_0_var(--color-mango-dark)]">
          <p className="text-[13px] font-semibold text-ink/70">11월 둘째 주 · 11.10 ~ 11.16</p>
          <p className="mt-1 text-[21px] font-bold leading-snug tracking-[-0.03em]">{SAMPLE.headline}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {SAMPLE.stats.map(([label, n]) => (
              <div key={label} className="rounded-xl bg-white/70 px-1 py-2.5 text-center">
                <p className="text-[12px] font-semibold text-ink/70">{label}</p>
                <p className="mt-0.5 font-round text-[22px] font-bold leading-none tabular-nums">{n}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="tile mt-3 p-4">
          <ul className="flex flex-col gap-3">
            {SAMPLE.bars.map(([name, seen, got]) => (
              <li key={name} className="grid grid-cols-[6.5rem_1fr_3.25rem] items-center gap-3">
                <span className="truncate text-[14px] font-semibold">{name}</span>
                <span className="h-3 rounded-full bg-snow">
                  <span className="block h-full rounded-full bg-mango-tint" style={{ width: `${(got / 20) * 100}%` }}>
                    <span className="block h-full rounded-full bg-mango" style={{ width: `${(seen / got) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right text-[13px] font-semibold text-sub tabular-nums">
                  <span className="text-ink">{seen}</span>/{got}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-line pt-3">
            {SAMPLE.keywords.map((k) => (
              <span key={k} className="rounded-full bg-snow px-3 py-1.5 text-[14px] font-semibold">
                #{k}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Link href="/premium" className="btn mt-8 w-full">
        <Crown className="size-5" />
        Premium으로 받기
      </Link>
    </div>
  );
}
