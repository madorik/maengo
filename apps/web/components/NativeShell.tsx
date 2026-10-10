"use client";

import { useEffect } from "react";
import { isAppUserAgent } from "@/lib/app-client";

// 앱(Capacitor) 안에서만 하는 일을 켠다(lib/native/shell.ts). 루트 레이아웃에 있어 페이지를 처음 열 때 한 번 돈다.
// 브라우저에서는 아무것도 하지 않고, 플러그인 코드도 따로 나뉜 조각이라 받지 않는다.
export function NativeShell() {
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
  return null;
}
