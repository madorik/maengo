"use client";

import { useEffect } from "react";
import { isAppUserAgent } from "@/lib/app-client";

/** 계정이 알림을 켜 뒀는데 이 앱 기기는 등록 전이면 한 번 등록한다(lib/native/push.ts registerAppOnce). 화면에는 아무것도 그리지 않는다 */
export function AppPushSync({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !isAppUserAgent(navigator.userAgent)) return;
    void import("@/lib/native/push").then((m) => m.registerAppOnce()).catch(() => {});
  }, [enabled]);
  return null;
}
