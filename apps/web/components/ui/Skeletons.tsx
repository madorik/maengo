"use client";

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
 * 오늘 화면(2026-11-26 시안 E안): 작은 줄 + 큰 제목 두 줄 + 근거 사실 줄 → '오늘의 흐름' 머리 + 흐름 카드(위 사진 칸, 아래 영향·요약 줄, 오른쪽에 다음 카드 끝). 관심 탭 줄은 뺐다(2026-11-26 사용자)
 * → '맞춤 소식' 머리 + 분야 칩 → 소식 줄. 머리 오른쪽 재생 원은 없다(2026-11-26 사용자, 전체 듣기는 떠 있는 플레이어).
 * 퇴근길이어도 밝기는 사용자가 고른 대로(남색으로 바꾸지 않는다, 2026-11-26)
 */
export function TodaySkeleton() {
  return (
    <div aria-busy="true">
      <Status />
      <div aria-hidden="true" className="mx-auto max-w-[640px] px-4 pb-4 pt-5 lg:pt-8">
        <div className="px-1.5">
          <div className="sk-ink h-3.5 w-44 rounded-full" />
          <div className="sk mt-3 h-[22px] w-11/12 max-w-[300px] rounded-lg" />
          <div className="sk mt-2 h-[22px] w-3/5 max-w-[210px] rounded-lg" />
          <div className="sk mt-3.5 h-4 w-full max-w-[340px] rounded-md" />
        </div>

        <div className="mt-7 flex min-h-11 items-center justify-between px-1.5">
          <div className="sk h-5 w-24 rounded-md" />
          <div className="sk-ink h-3.5 w-14 rounded-full" />
        </div>
        <div className="-mx-4 mt-1 flex gap-3 overflow-hidden px-[22px] pb-1">
          {[0, 1].map((k) => (
            <div key={k} className="w-[calc(100%-30px)] max-w-[360px] shrink-0 overflow-hidden rounded-[22px] border border-line">
              <div className="sk-card-ink h-[228px]" />
              <div className="h-[170px] px-4 pt-4">
                <div className="sk h-[18px] w-11/12 rounded-md" />
                <div className="sk mt-2 h-[18px] w-3/5 rounded-md" />
                <div className="sk mt-4 h-3.5 w-4/5 rounded-md" />
                <div className="sk mt-2.5 h-3.5 w-2/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex min-h-11 items-center justify-between px-1.5">
          <div className="sk h-5 w-24 rounded-md" />
          <div className="sk-ink h-3.5 w-14 rounded-full" />
        </div>
        <div className="-mx-4 mt-1 flex gap-2 overflow-hidden px-[22px]">
          {[52, 52, 68, 68, 60].map((w, k) => (
            <span key={k} className="sk h-9 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <ul className="mt-1 px-1.5">
          {[0, 1, 2].map((k) => (
            <li key={k} className="flex items-start gap-3.5 border-b border-line py-4">
              <div className="min-w-0 flex-1">
                <div className="sk-ink h-3 w-10 rounded-full" />
                <div className="sk mt-2.5 h-[15px] w-11/12 rounded-md" />
                <div className="sk mt-2 h-[15px] w-3/5 rounded-md" />
                <div className="sk-ink mt-3.5 h-[11px] w-2/5 rounded-full" />
              </div>
              <div className="sk size-[92px] shrink-0 rounded-[14px]" />
            </li>
          ))}
        </ul>
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
