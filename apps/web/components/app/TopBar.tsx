"use client";

import { AccountMenu } from "./AccountMenu";
import { HomeLink } from "./HomeLink";

/**
 * 모바일 위쪽 막대: 로고 + 머리말 + 오른쪽 계정 메뉴(프로필 사진, Premium이면 왕관).
 * 메뉴는 아래 메뉴(BottomNav)로 내렸고 ☰ 서랍은 없앴다(2026-11-26 사용자). 프로필 사진은 그대로 둔다(같은 날 사용자: 프로필이 안 보인다)
 */
export function TopBar() {
  return (
    <header data-topbar className="sticky top-0 z-20 border-b border-line bg-paper pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center gap-1 pl-5 pr-2">
        {/* 머리말 '맹고 | 오늘 뉴스 핵심 요약'(2026-11-12 사용자: 11-11 '오늘 뉴스, 내게 미칠 영향은?'에서 바꿈. 화면에 '뉴스'를 쓰는 예외) */}
        <HomeLink className="flex items-center gap-2.5 no-underline">
          <span className="text-[21px] font-bold tracking-[-0.035em] text-ink">맹고</span>
          <span aria-hidden="true" className="h-3.5 w-px bg-line-dark" />
          <span className="text-[15px] font-medium tracking-[-0.02em] text-sub">오늘 뉴스 핵심 요약</span>
        </HomeLink>
        <div className="ml-auto">
          <AccountMenu placement="down" />
        </div>
      </div>
    </header>
  );
}
