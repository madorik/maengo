"use client";

import { useEffect, useRef } from "react";
import { withBase } from "@/lib/base-path";

// 소개 영상(소리 없음, 자동 재생·반복). 배경이 페이지 색과 같은 두 벌(밝은·어두운 화면)이 있어 지금 테마에 맞는 쪽을 튼다.
// 테마는 설정의 다크 모드(<html data-theme>)가 있으면 그것, 없으면 기기 설정(prefers-color-scheme)을 따른다(globals.css와 같은 규칙).
// 움직임을 줄인 설정이거나 자동 재생이 막히면(저전력 모드 등) 재생 버튼을 보여 준다.
const SRC = { light: withBase("/promo/maengo-promo-light.mp4"), dark: withBase("/promo/maengo-promo-dark.mp4") };
const POSTER = { light: withBase("/promo/maengo-promo-light.jpg"), dark: withBase("/promo/maengo-promo-dark.jpg") };

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function PromoVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const apply = () => {
      const theme = currentTheme();
      if (v.getAttribute("src") === SRC[theme]) return;
      const t = v.currentTime;
      v.poster = POSTER[theme];
      v.src = SRC[theme];
      v.currentTime = t;
      if (!reduced) v.play().catch(() => { v.controls = true; });
    };
    apply();
    if (reduced) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; }
    else v.play().catch(() => { v.controls = true; });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", apply); mo.disconnect(); };
  }, []);

  return (
    <video
      ref={ref}
      className={`block h-auto w-full rounded-[28px] bg-paper ${className}`}
      src={SRC.light}
      poster={POSTER.light}
      width={720}
      height={1280}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="맹고 소개 영상. 아침 알림을 열고 전체 듣기를 누르면 소식을 이어서 읽어 주고, 화면을 꺼도 계속 들려요. 관심사와 자주 보는 블로그 주소를 고를 수 있어요"
    />
  );
}
