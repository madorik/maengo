"use client";

import { useEffect } from "react";
import { platformOf, track } from "@/lib/analytics";

/**
 * 로그인한 화면에서 한 번: GA4 사용자 ID(회원 id의 해시, 서버가 만든다)·플랜·플랫폼을 알리고,
 * 알림을 눌러 들어왔으면(?from=push) push_open을 남긴다. (app) 레이아웃에 있다
 */
export function AnalyticsSession({ uid, plan }: { uid: string; plan: string }) {
  useEffect(() => {
    track("identify", { user_id: uid, plan, platform: platformOf(navigator.userAgent) });
    if (new URLSearchParams(location.search).get("from") === "push") track("push_open");
  }, [uid, plan]);
  return null;
}
