"use client";

import Link from "next/link";
import { MangoIcon } from "@/components/MangoIcon";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { AccountMenu } from "./AccountMenu";
import { NavLinks } from "./NavLinks";

/** 데스크톱 왼쪽 메뉴(모바일은 위쪽 막대의 ☰로 여는 MobileNav) */
export function SideNav() {
  return (
    <div className="sticky top-0 hidden h-dvh flex-col border-r-2 border-line px-4 py-7 lg:flex">
      <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 px-3 no-underline">
        <MangoIcon className="size-9" />
        <span className="text-[28px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
        <BetaBadge />
      </Link>
      <div className="mt-8">
        <NavLinks />
      </div>
      {/* 계정(프로필 사진·이름 → 로그아웃)은 왼쪽 아래. Premium이면 사진에 왕관 */}
      <div className="mt-auto border-t-2 border-line pt-3">
        <AccountMenu placement="up" />
      </div>
    </div>
  );
}
