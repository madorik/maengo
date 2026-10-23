"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAppUserAgent } from "@/lib/app-client";
import { SwipePager } from "./SwipePager";
import { NAV } from "./nav";

// 앱에서 오늘·보관함·플레이리스트를 좌우로 밀어서 옮긴다(메뉴 순서와 같다. 왼쪽으로 밀면 다음 탭). 미는 동작은 SwipePager

export function SwipeTabs({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const index = NAV.findIndex((n) => n.href === pathname);
  const prev = index > 0 ? NAV[index - 1] : undefined;
  const next = index >= 0 ? NAV[index + 1] : undefined;

  // 옆 탭은 미리 받아 둬서 넘기자마자 뜨게 한다
  useEffect(() => {
    if (!isAppUserAgent(navigator.userAgent)) return;
    if (prev) router.prefetch(prev.href);
    if (next) router.prefetch(next.href);
  }, [router, prev, next]);

  return (
    <SwipePager
      as="main"
      className={className}
      prev={prev}
      next={next}
      // 오늘에서 떠날 때만 기록을 쌓는다. 그래야 안드로이드 뒤로 가기가 늘 오늘로 돌아오고, 오늘에서는 앱을 내린다(lib/native/shell.ts)
      go={(href) => (pathname === "/today" ? router.push(href) : router.replace(href))}
    >
      {children}
    </SwipePager>
  );
}
