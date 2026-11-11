"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 메뉴 화면 위쪽(모바일 TopBar)·왼쪽(데스크톱 SideNav)의 맹고 로고(2026-11-11).
 * 예전엔 소개(/)로 갔는데, 앱은 소개 대신 서버가 /today로 되돌려 보내서(proxy.ts) 오늘 화면을 처음부터 다시 그리느라 오래 걸렸다.
 * 이제 오늘 소식으로 간다. 이미 오늘 화면이면 다시 불러오지 않고 맨 위로만 올린다
 */
export function HomeLink({ className, children }: { className: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href="/today"
      aria-label="오늘 소식"
      className={className}
      onClick={(e) => {
        if (pathname !== "/today") return;
        e.preventDefault();
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      {children}
    </Link>
  );
}
