"use client";

import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";
import { AccountMenu } from "./AccountMenu";
import { MobileNav } from "./MobileNav";

/** 모바일 위쪽 막대: 메뉴(☰, 왼쪽 서랍) + 로고 + 계정 메뉴(Premium이면 사진에 왕관) */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-white pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center gap-1 pl-1.5 pr-2">
        <MobileNav />
        <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 no-underline">
          <MangoIcon className="size-9" />
          <span className="text-[26px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
        </Link>
        <div className="ml-auto">
          <AccountMenu placement="down" />
        </div>
      </div>
    </header>
  );
}
