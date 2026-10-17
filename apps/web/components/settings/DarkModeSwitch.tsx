"use client";

import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/Switch";
import { isDarkNow, setThemePref, THEME_EVENT } from "@/lib/theme";

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
};

/** 설정 > 화면: 다크 모드 켜고 끄기. 한 번도 안 눌렀으면 기기 설정을 따르고, 누르면 이 기기에 그 값으로 둔다(lib/theme.ts) */
export function DarkModeSwitch() {
  const dark = useSyncExternalStore(subscribe, isDarkNow, () => false);
  return <Switch label="다크 모드" checked={dark} onChange={(on) => setThemePref(on ? "dark" : "light")} />;
}
