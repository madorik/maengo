import Link from "next/link";
import { ToneIcon } from "@/components/ui/ToneIcon";

// Free가 리포트 메뉴를 열면: 어떤 리포트인지 예시 한 장과 Premium 안내(요금 페이지로). 예시 숫자·문구는 지어낸 것이라 '예시'로 표시한다
// 2026-11-25 6안: 노랑 큰 카드·검정 맞춤 체크 상자를 빼고 실제 리포트처럼 연한 주황 총평 상자와 회색 둥근 카드로. 예전 '맞춤 체크'는 지금 '내 관심사에 준 영향'이라 이름도 맞췄다

const SAMPLE = {
  headline: "엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요",
  tones: [
    ["minus", "부담", 14, "text-minus"],
    ["plus", "긍정", 13, "text-plus"],
    ["watch", "지켜볼", 4, "text-watch"],
  ] as const,
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
  personal: { about: "국내 주식", title: "반도체 변동성이 커졌어요", text: "HBM 공급 경쟁 소식에 반도체주가 크게 오르내렸어요. 다음 주 실적 발표 일정을 확인해 보세요." },
};

export function ReportTeaser() {
  return (
    <div>
      <ul className="flex flex-col gap-2 text-[16px] font-bold leading-relaxed">
        <li>매주 월요일 아침, 한 주 받은 소식을 정리하고 내 상황에 맞춰 짚어 드려요</li>
        <li className="text-sub">한 줄 총평과 숫자는 Free에서도 보여 드려요. 내 관심사에 준 영향, 요일별 차트, 다음 주 지켜볼 것, 분야별 정리, 놓친 주요 소식은 Premium에서 한 장에</li>
      </ul>

      {/* 예시. 화면 읽기 프로그램에는 숨기고 위 설명으로 대신한다 */}
      <div aria-hidden="true" className="relative mt-6 select-none">
        <span className="absolute -top-3 left-4 z-10 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">예시</span>
        <div className="rounded-[18px] bg-mango-tint px-[18px] pb-[18px] pt-6">
          <p className="text-[13px] font-semibold text-sub">11월 둘째 주, 11.10 ~ 11.16</p>
          <p className="mt-1.5 text-[20px] font-extrabold leading-[1.45] tracking-[-0.04em]">{SAMPLE.headline}</p>
          <p className="mt-3.5 flex flex-wrap gap-1.5">
            {SAMPLE.tones.map(([tone, name, n, color]) => (
              <span key={tone} className={`inline-flex h-7 items-center gap-1 rounded-full bg-paper px-2.5 text-[12px] font-bold tabular-nums ${color}`}>
                <ToneIcon tone={tone} className="size-3" />
                {`${name} ${n}개`}
              </span>
            ))}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SAMPLE.stats.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-snow px-1 py-3 text-center">
              <p className="text-[12px] font-semibold text-sub">{label}</p>
              <p className="mt-1 font-round text-[22px] font-extrabold leading-none tabular-nums">{n}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-snow px-4 py-4">
          <p className="flex items-center gap-2">
            <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-watch-tint px-2.5 text-[12px] font-bold text-watch">
              <ToneIcon tone="watch" />
              지켜볼 변수
            </span>
            <span className="text-[13px] font-bold text-ink/80">{SAMPLE.personal.about}</span>
          </p>
          <p className="mt-2.5 text-[16px] font-extrabold leading-snug tracking-[-0.03em]">{SAMPLE.personal.title}</p>
          <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-ink/80">{SAMPLE.personal.text}</p>
        </div>
        <div className="mt-3 rounded-2xl bg-snow p-4">
          <ul className="flex flex-col gap-3">
            {SAMPLE.bars.map(([name, seen, got]) => (
              <li key={name} className="grid grid-cols-[6.5rem_1fr_3.25rem] items-center gap-3">
                <span className="truncate text-[14px] font-semibold">{name}</span>
                <span className="h-2.5 rounded-full bg-paper">
                  <span className="block h-full rounded-full bg-line-dark" style={{ width: `${(got / 20) * 100}%` }}>
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(seen / got) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right text-[13px] font-semibold text-sub tabular-nums">
                  <span className="text-ink">{seen}</span>/{got}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line-dark/40 pt-3">
            {SAMPLE.keywords.map((k) => (
              <span key={k} className="inline-flex h-8 items-center rounded-full border border-line-dark px-3 text-[13px] font-semibold">
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Link href="/premium" className="btn mt-8 w-full">
        Premium으로 받기
      </Link>
    </div>
  );
}
