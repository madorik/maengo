"use client";

import { useEffect, useSyncExternalStore } from "react";
import { appInfoOf, isAppUserAgent } from "@/lib/app-client";

const noSubscribe = () => () => {};

// 안드로이드 3버튼 내비게이션 바(48dp)는 투명해서 스크롤하는 내용이 뒤로 가기·홈 버튼 밑으로 비친다. 그 자리를 바탕색으로 덮는다.
// 제스처 막대(24dp 안팎)는 iOS 홈 막대처럼 내용이 밑으로 지나가게 둔다: 아래 여백이 32px 이하면 0, 넘으면 그 값(계단 함수)
const NAV_BUTTONS_HEIGHT = "min(env(safe-area-inset-bottom), max(0px, (env(safe-area-inset-bottom) - 32px) * 1000))";

// 앱(Capacitor) 안에서만 하는 일을 켠다(lib/native/shell.ts). 루트 레이아웃에 있어 페이지를 처음 열 때 한 번 돈다.
// 브라우저에서는 아무것도 하지 않고, 플러그인 코드도 따로 나뉜 조각이라 받지 않는다.
export function NativeShell() {
  const android = useSyncExternalStore(noSubscribe, () => appInfoOf(navigator.userAgent)?.platform === "android", () => false);
  useEffect(() => {
    if (!isAppUserAgent(navigator.userAgent)) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/native/shell").then((m) => {
      if (!cancelled) stop = m.startNativeShell();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return android ? <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] bg-paper" style={{ height: NAV_BUTTONS_HEIGHT }} /> : null;
}
