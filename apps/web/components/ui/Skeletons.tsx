"use client";

import { useToday } from "@/components/providers/TodayProvider";

// 불러오는 동안의 뼈대(2026-11-11 로딩 화면 A안, 시안 https://claude.ai/artifact/Wcay6b7FSyMKWDBbULeQMj).
// 다 불러온 화면과 같은 자리에 같은 모양으로 그려서 덜컥 바뀌지 않게 한다. 빛이 지나가는 움직임은 globals.css의 sk·sk-*(움직임 줄이기면 멈춘다)

function Status() {
  return (
    <p role="status" className="sr-only">
      불러오는 중
    </p>
  );
}

/**
 * 오늘 화면: 맞춤 인사이트 머리말 → 큰 제목 두 줄 → 바탕 줄 → 흐름 카드(남색·망고) → 맞춤 체크 → 브리핑 듣기 막대 → 노선 목록.
 * 퇴근길(남색 바탕)이면 같은 모양을 남색 위에. 오늘 데이터는 레이아웃이 이미 읽어 두어 시간대를 안다
 */
export function TodaySkeleton() {
  const { data } = useToday();
  const pm = data.slot === "pm";
  const bar = pm ? "sk-night" : "sk";
  const mango = pm ? "sk-night" : "sk-mango";
  return (
    <div aria-busy="true" className={pm ? "min-h-dvh bg-[#1F2340]" : ""}>
      <Status />
      <div aria-hidden="true" className="mx-auto max-w-[640px] px-4 pb-4 pt-5 lg:pt-8">
        <div className="px-1.5">
          <div className={`h-3.5 w-40 rounded-full ${mango}`} />
          <div className={`mt-3.5 h-7 w-11/12 max-w-[320px] rounded-lg ${bar}`} />
          <div className={`mt-2.5 h-7 w-3/5 max-w-[240px] rounded-lg ${bar}`} />
          <div className={`mt-4 h-3.5 w-full max-w-[330px] rounded-full ${bar}`} />
          <div className={`mt-2 h-3 w-3/4 max-w-[250px] rounded-full ${bar}`} />

          <div className="-mx-5 mt-5 flex gap-3 overflow-hidden px-5">
            <div className={`flex h-[200px] w-[80%] max-w-[300px] shrink-0 flex-col rounded-[24px] p-5 ${pm ? "bg-white/10" : "sk-card-ink"}`}>
              <div className={`h-6 w-28 rounded-full ${pm ? "sk-night" : "sk-ink"}`} />
              <div className={`mt-3.5 h-5 w-3/5 rounded-md ${pm ? "sk-night" : "sk-ink"}`} />
              <div className={`mt-3 h-3 w-11/12 rounded-full ${pm ? "sk-night" : "sk-ink"}`} />
              <div className={`mt-2 h-3 w-full rounded-full ${pm ? "sk-night" : "sk-ink"}`} />
              <div className={`mt-2 h-3 w-3/4 rounded-full ${pm ? "sk-night" : "sk-ink"}`} />
              <div className={`mt-auto h-3 w-24 rounded-full ${pm ? "sk-night" : "sk-ink"}`} />
            </div>
            <div className={`flex h-[200px] w-[80%] max-w-[300px] shrink-0 flex-col rounded-[24px] p-5 ${pm ? "bg-white/10" : "bg-mango-tint"}`}>
              <div className={`h-6 w-24 rounded-full ${mango}`} />
              <div className={`mt-3.5 h-5 w-1/2 rounded-md ${mango}`} />
              <div className={`mt-3 h-3 w-4/5 rounded-full ${mango}`} />
            </div>
          </div>

          <div className="mt-7">
            <div className={`h-4 w-24 rounded-full ${bar}`} />
            <div className={`mt-3.5 h-3 w-24 rounded-full ${mango}`} />
            <div className={`mt-2 h-[18px] w-3/5 max-w-[220px] rounded-md ${bar}`} />
            <div className={`mt-2.5 h-3 w-full rounded-full ${bar}`} />
            <div className={`mt-2 h-3 w-4/5 rounded-full ${bar}`} />
          </div>
        </div>

        <div className={`mt-6 flex h-16 items-center gap-3.5 rounded-full px-2 ${pm ? "bg-white/10" : "bg-[#1F2340]"}`}>
          <span className={`size-12 shrink-0 rounded-full ${pm ? "bg-white/15" : "bg-mango/80"}`} />
          <span className={`h-4 w-36 rounded-full ${pm ? "sk-night" : "bg-white/15"}`} />
        </div>

        <div className="mt-7 flex flex-col gap-5 px-1.5">
          {[0, 1, 2].map((k) => (
            <div key={k} className="flex items-center gap-3.5">
              <span className={`size-3 shrink-0 rounded-full border-[3px] ${pm ? "border-white/20" : "border-line"}`} />
              <div className="min-w-0 flex-1">
                <div className={`h-[15px] w-11/12 rounded-md ${bar}`} />
                <div className={`mt-2 h-[15px] w-3/5 rounded-md ${bar}`} />
              </div>
              <div className={`aspect-[3/2] w-[84px] shrink-0 rounded-xl ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 보관함: 제목('보관함'은 바로) → 찾기 칸 → 거르기 칩 → '최신순' 줄 → 썸네일 목록 */
export function LibrarySkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[680px] px-4 py-6 lg:py-10">
      <Status />
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-[26px] font-bold tracking-[-0.035em]">보관함</h1>
        <div aria-hidden="true" className="flex items-center gap-2">
          <span className="sk h-10 w-20 rounded-full" />
          <span className="sk h-10 w-24 rounded-full" />
        </div>
      </div>
      <div aria-hidden="true">
        <div className="mt-4 flex h-12 items-center gap-3 rounded-full bg-snow pl-3.5">
          <span className="size-5 rounded-full border-2 border-line" />
          <span className="sk h-3 w-28 rounded-full" />
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-hidden px-4 pb-2">
          {[56, 68, 76, 60, 68].map((w) => (
            <span key={w} className="sk h-9 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="mt-4 px-1">
          <span className="sk block h-3 w-14 rounded-full" />
        </div>
        <ul className="mt-2">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <li key={k} className="flex items-center gap-3 border-b border-line py-3">
              <div className="sk aspect-[3/2] w-[92px] shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="sk h-[15px] w-11/12 rounded-md" />
                <div className="sk mt-2 h-[15px] w-3/5 rounded-md" />
                <div className="sk mt-2 h-[11px] w-2/5 rounded-full" />
              </div>
              <div className="sk size-6 shrink-0 rounded-md" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
