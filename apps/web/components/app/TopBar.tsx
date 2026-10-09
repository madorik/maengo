"use client";

import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";
import { StatChips } from "./StatChips";

/** 모바일 위쪽 막대: 로고 + 연속 기록·XP·플랜 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-white pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="mx-auto flex min-h-14 max-w-[640px] items-center justify-between pl-4 pr-2">
        <Link href="/" aria-label="맹고 소개" className="no-underline">
          <MangoIcon className="size-9" />
        </Link>
        <StatChips />
      </div>
    </header>
  );
}
