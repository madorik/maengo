"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// 네이버 검색광고 전환 추적(2026-11-06, naver.github.io/conversion-tracking wcs.trans 방식).
// 공통키(NEXT_PUBLIC_NAVER_WA, 검색광고 > 도구 > 전환추적의 '네이버 공통키')가 있고 운영 빌드일 때만 싣는다.
// 광고 쿠키라 공통키를 넣기 전에 개인정보 처리방침 8조(쿠키)의 '광고 쿠키는 쓰지 않습니다'를 고친다(맹고-문서/광고.md).
// 페이지를 열 때마다 PV(wcs_do)를 보내야 해서, 화면을 옮길 때(클라이언트 이동)도 다시 보낸다.
// 전환(웹에서 가입 완료 = sign_up)은 lib/analytics.ts track()이 wcs.trans로 보낸다. 결제는 앱 안에서만 일어나 네이버 광고와 이어지지 않아 보내지 않는다
const WA = /^[A-Za-z0-9_]+$/.test(process.env.NEXT_PUBLIC_NAVER_WA?.trim() ?? "") ? process.env.NEXT_PUBLIC_NAVER_WA!.trim() : null;

type Wcs = { inflow: (domain: string) => void };
type NaverWindow = Window & { wcs?: Wcs; wcs_add?: Record<string, string>; wcs_do?: () => void };

function sendPageView() {
  const w = window as NaverWindow;
  if (!w.wcs || !w.wcs_do) return;
  w.wcs_add = w.wcs_add ?? {};
  w.wcs_add.wa = WA!;
  // 쿠키는 최상위 도메인에(watalabs.com, 회사 사이트와 같은 사람으로 본다)
  w.wcs.inflow("watalabs.com");
  w.wcs_do();
}

export function NaverAnalytics() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (!WA) return;
    // 첫 화면은 스크립트가 다 받아진 뒤(onLoad) 보낸다
    if (first.current) {
      first.current = false;
      return;
    }
    sendPageView();
  }, [pathname]);
  if (!WA || process.env.NODE_ENV !== "production") return null;
  return <Script src="https://wcs.naver.net/wcslog.js" strategy="afterInteractive" onLoad={sendPageView} />;
}
