"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NAV_MORE } from "./nav";

/** 주 메뉴 링크(오늘·보관함·플레이리스트, 아래에 요금. 설정은 계정 메뉴에). 데스크톱 왼쪽 메뉴(SideNav)와 모바일 서랍(MobileNav)이 같이 쓴다 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-2">
      {[...NAV, ...NAV_MORE].map(({ href, label, Icon }) => {
        const current = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-[52px] items-center gap-4 rounded-xl border-2 px-3 text-[16px] font-extrabold no-underline ${
              current ? "border-mango bg-mango-tint text-mango-deep" : "border-transparent text-sub hover:bg-snow"
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
