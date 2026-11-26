"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentTab, NAV } from "./nav";

/**
 * 모바일 아래 메뉴(2026-11-26 사용자 '메뉴를 밑으로 내리자', 6안): 윗모서리가 둥근 흰 막대에 브리핑·보관함·리포트·설정.
 * 지금 칸은 망고 알약 위 남색 아이콘 + 굵은 글자, 나머지는 회색. 데스크톱은 왼쪽 메뉴(SideNav)라 숨긴다.
 * data-tabbar가 있으면 globals.css가 --tabbar-h를 잡아 떠 있는 플레이어·알림·고르기 막대가 그 위로 올라간다
 */
export function BottomNav() {
  const tab = currentTab(usePathname());
  return (
    <nav
      data-tabbar
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-[24px] border-t border-line bg-paper pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgb(31_35_64/0.06)] lg:hidden dark:shadow-[0_-6px_24px_rgb(0_0_0/0.4)]"
    >
      <div className="mx-auto grid max-w-[640px] grid-cols-4 px-3">
        {NAV.map(({ href, label, Icon }) => {
          const on = tab === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] tracking-[-0.01em] no-underline ${on ? "font-extrabold text-ink" : "font-semibold text-sub"}`}
            >
              <span className={`flex h-[30px] w-14 items-center justify-center rounded-full transition-colors duration-150 ${on ? "bg-mango text-[#1F2340]" : ""}`}>
                <Icon className={`size-[22px] ${on ? "[stroke-width:2.2]" : ""}`} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
