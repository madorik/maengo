"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/providers/ProfileProvider";
import { NAV, NAV_MORE } from "./nav";

/** 주 메뉴 링크(오늘 소식·보관함·플레이리스트, 아래에 내 관심 키워드·주간 리포트·요금(Premium이면 뺌). 설정은 계정 메뉴에). 데스크톱 왼쪽 메뉴(SideNav)와 모바일 서랍(MobileNav)이 같이 쓴다 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // Premium(체험 포함)이면 '요금'은 뺀다(2026-11-11 사용자: 메뉴가 너무 많다). 구독 관리는 설정 > 플랜에서 한다
  const premium = useProfile().plan === "plus";
  const links = [...NAV, ...NAV_MORE].filter((l) => !(premium && l.href === "/premium"));
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-2">
      {links.map(({ href, label, Icon }) => {
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
