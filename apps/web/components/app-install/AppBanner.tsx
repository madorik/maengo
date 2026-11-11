"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { MangoIcon } from "@/components/MangoIcon";
import { IconClose } from "@/components/icons";
import { track } from "@/lib/analytics";
import { hiddenRecently, hideFor7Days, installHref, isIosSafari, isMobileWeb } from "@/lib/app-install";

// 휴대폰 웹의 로그인 전 화면 맨 위 띠(2026-11-11, lib/app-install.ts). 소개·둘러보기·공유받은 소식·분야 페이지에만.
// iPhone 사파리는 애플 기본 배너가 같은 자리에 떠서 숨긴다. 닫으면 7일 동안 안 보인다.
// 화면 흐름 안에 둔다(고정하지 않는다): 내리면 같이 사라지고 각 화면의 붙는 머리말이 맨 위에 남는다.
const KEY = "maengo_app_banner_closed";
const PUBLIC = /^\/($|try$|s\/|topics(\/|$))/;

const noSubscribe = () => () => {};

/** 그 화면의 자리 이름(GA4 where) */
function whereOf(pathname: string): string {
  if (pathname === "/") return "banner_landing";
  if (pathname.startsWith("/s/")) return "banner_share";
  if (pathname === "/try") return "banner_try";
  return "banner_topics";
}

export function AppBanner() {
  const pathname = usePathname();
  // 서버와 첫 그림은 띠 없이(기기·닫은 기록은 브라우저에서만 안다)
  const can = useSyncExternalStore(noSubscribe, () => isMobileWeb() && !isIosSafari(navigator.userAgent) && !hiddenRecently(KEY), () => false);
  const [closed, setClosed] = useState(false);
  if (!can || closed || !PUBLIC.test(pathname)) return null;
  const where = whereOf(pathname);
  return (
    <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-2.5">
      <MangoIcon className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight">맹고 앱</p>
        <p className="mt-0.5 truncate text-[13px] text-sub">출퇴근 알림 받고, 화면 꺼도 들어요</p>
      </div>
      <a href={installHref(where)} onClick={() => track("app_install_click", { where })} className="btn btn-ink min-h-9 shrink-0 px-4 text-[14px]">
        받기
      </a>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => {
          hideFor7Days(KEY);
          setClosed(true);
        }}
        className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-sub"
      >
        <IconClose className="size-4" />
      </button>
    </div>
  );
}
