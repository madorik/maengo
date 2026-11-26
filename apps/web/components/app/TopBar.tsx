"use client";

import { HomeLink } from "./HomeLink";

/**
 * 모바일 위쪽 막대: 로고 + 머리말. 메뉴는 아래 메뉴(BottomNav)로 내렸고(2026-11-26 사용자),
 * 예전 ☰ 서랍과 오른쪽 프로필 사진(계정 메뉴)의 일은 아래 메뉴 '설정'이 한다
 */
export function TopBar() {
  return (
    <header data-topbar className="sticky top-0 z-20 border-b border-line bg-paper pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center px-5">
        {/* 머리말 '맹고 | 오늘 뉴스 핵심 요약'(2026-11-12 사용자: 11-11 '오늘 뉴스, 내게 미칠 영향은?'에서 바꿈. 화면에 '뉴스'를 쓰는 예외) */}
        <HomeLink className="flex items-center gap-2.5 no-underline">
          <span className="text-[21px] font-bold tracking-[-0.035em] text-ink">맹고</span>
          <span aria-hidden="true" className="h-3.5 w-px bg-line-dark" />
          <span className="text-[15px] font-medium tracking-[-0.02em] text-sub">오늘 뉴스 핵심 요약</span>
        </HomeLink>
      </div>
    </header>
  );
}
