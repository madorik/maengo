"use client";

import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { useEffect } from "react";
import { isDarkNow, PAPER, THEME_EVENT } from "@/lib/theme";

/** 테마가 바뀌면(설정에서 고름, 시스템 전환) 브라우저 위쪽 막대 색과 앱 상태 표시줄 글자색을 맞춘다 */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = isDarkNow();
      for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = dark ? PAPER.dark : PAPER.light;
      if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener(THEME_EVENT, apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener(THEME_EVENT, apply);
    };
  }, []);
  return null;
}
