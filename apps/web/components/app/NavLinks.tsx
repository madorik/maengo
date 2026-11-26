"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/providers/ProfileProvider";
import { currentLink, NAV, NAV_MORE } from "./nav";

/** 데스크톱 왼쪽 메뉴(SideNav) 링크: 아래 메뉴와 같은 브리핑·보관함·리포트·설정, 그 아래 내 관심 키워드·요금(Premium이면 뺌). 플레이리스트는 넣지 않는다(2026-11-26 사용자) */
export function NavLinks() {
  const pathname = usePathname();
  // Premium(체험 포함)이면 '요금'은 뺀다(2026-11-11 사용자: 메뉴가 너무 많다). 구독 관리는 설정 > 플랜에서 한다
  const premium = useProfile().plan === "plus";
  const links = [...NAV, ...NAV_MORE].filter((l) => !(premium && l.href === "/premium"));
  const on = currentLink(pathname);
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-2">
      {links.map(({ href, label, Icon }) => {
        const current = on === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-[52px] items-center gap-4 rounded-xl border-2 px-3 text-[16px] font-extrabold no-underline ${
              current ? "border-mango bg-snow text-mango-deep" : "border-transparent text-sub hover:bg-snow"
            }`}
          >
            <Icon className="size-7" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
