"use client";

import { useEffect } from "react";
import { useProfile } from "@/components/providers/ProfileProvider";
import { isAppUserAgent } from "@/lib/app-client";

/**
 * 앱(iOS)을 열면 Apple 검색 광고 출처를 RevenueCat에 넘긴다(lib/native/billing.ts collectAdAttribution). 화면에는 아무것도 그리지 않는다.
 * NEXT_PUBLIC_ASA_ATTRIBUTION=1일 때만: 켜기 전에 개인정보 처리방침의 RevenueCat 항목에 '앱 설치 경로'를 더한다(맹고-문서/광고.md)
 */
const ENABLED = process.env.NEXT_PUBLIC_ASA_ATTRIBUTION === "1";

export function AppAdAttribution() {
  const { id } = useProfile();
  useEffect(() => {
    if (!ENABLED || !isAppUserAgent(navigator.userAgent)) return;
    void import("@/lib/native/billing").then((m) => m.collectAdAttribution(id)).catch(() => {});
  }, [id]);
  return null;
}
