// 보관함으로 옮길 때 바로 보이는 뼈대(2026-11-11 로딩 A안, 2026-11-26 시안 모양으로). 다 불러온 화면과 같은 자리에 같은 모양: 제목 → 검색창 → 보기 칩 → 분야 탭 → 날짜 머리 → 소식 줄
// 빛이 지나가는 움직임은 globals.css의 sk(움직임 줄이기면 멈춘다)

export function LibrarySkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[680px] px-5 pb-6 pt-[22px] lg:py-10">
      <p role="status" className="sr-only">
        불러오는 중
      </p>
      <div className="flex min-h-10 items-center gap-3">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-[-0.05em]">보관함</h1>
        <span aria-hidden="true" className="sk h-10 w-[108px] rounded-full" />
      </div>
      <div aria-hidden="true">
        <div className="mt-4 flex h-12 items-center gap-2.5 rounded-full bg-snow pl-4">
          <span className="size-5 rounded-full border-2 border-line" />
          <span className="sk h-3 w-32 rounded-full" />
        </div>
        <div className="mt-[18px] flex gap-1.5">
          {[78, 96, 88].map((w) => (
            <span key={w} className="sk h-[38px] shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="-mx-5 mt-1.5 flex gap-5 overflow-hidden px-5 shadow-[inset_0_-1px_0_var(--color-line)]">
          {[62, 28, 42, 42, 28, 28].map((w, i) => (
            <span key={i} className="flex h-[46px] shrink-0 items-center border-b-[3px] border-transparent">
              <span className="sk h-3.5 rounded-full" style={{ width: w }} />
            </span>
          ))}
        </div>
        <div className="mt-6">
          <span className="sk block h-[18px] w-16 rounded-md" />
        </div>
        <ul>
          {[0, 1, 2, 3, 4].map((k) => (
            <li key={k} className="flex items-start gap-3.5 border-b border-line py-4">
              <div className="min-h-[92px] min-w-0 flex-1">
                <div className="sk h-3 w-12 rounded-full" />
                <div className="sk mt-2.5 h-4 w-11/12 rounded-md" />
                <div className="sk mt-2 h-4 w-3/5 rounded-md" />
                <div className="sk mt-5 h-3 w-2/5 rounded-full" />
              </div>
              <div className="sk size-[92px] shrink-0 rounded-[14px]" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
