"use client";

import { AccountMenu } from "./AccountMenu";
import { HomeLink } from "./HomeLink";
import { MobileNav } from "./MobileNav";

/** 모바일 위쪽 막대: 메뉴(☰, 왼쪽 서랍) + 로고 + 계정 메뉴(Premium이면 사진에 왕관) */
export function TopBar() {
  return (
    <header data-topbar className="sticky top-0 z-20 border-b border-line bg-paper pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center gap-1 pl-1.5 pr-2">
        <MobileNav />
        {/* 머리말 '맹고 | 내 관심 뉴스 요약'(2026-11-10 사용자, 화면에 '뉴스'를 쓰는 예외) */}
        <HomeLink className="flex items-center gap-2.5 pl-1 no-underline">
          <span className="text-[21px] font-bold tracking-[-0.035em] text-ink">맹고</span>
          <span aria-hidden="true" className="h-3.5 w-px bg-line-dark" />
          <span className="text-[15px] font-medium tracking-[-0.02em] text-sub">내 관심 뉴스 요약</span>
        </HomeLink>
        <div className="ml-auto">
          <AccountMenu placement="down" />
        </div>
      </div>
    </header>
  );
}
