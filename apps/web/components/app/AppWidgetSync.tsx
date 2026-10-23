"use client";

import { useEffect, useRef } from "react";
import { useToday } from "@/components/providers/TodayProvider";
import { isAppUserAgent } from "@/lib/app-client";

/**
 * 앱(1.3부터)의 홈 화면 위젯과 별점 요청. 화면에는 아무것도 그리지 않는다.
 * 로그인한 화면이 열리면 위젯 토큰을 넘기고, 오늘 소식이 바뀌거나 읽음이 늘면 위젯을 다시 그린다(읽은 소식은 위젯에서 흐리게 보인다).
 * 오늘 소식을 다 본 순간 별점 요청 조건을 본다(lib/native/review.ts)
 */
export function AppWidgetSync() {
  const { data, game } = useToday();
  const inApp = useRef(false);

  useEffect(() => {
    inApp.current = isAppUserAgent(navigator.userAgent);
    if (!inApp.current) return;
    void import("@/lib/native/widget").then((m) => m.syncWidget());
  }, []);

  // 처음 그릴 때는 syncWidget이 다시 그리므로 바뀐 뒤에만
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!inApp.current) return;
    const t = window.setTimeout(() => void import("@/lib/native/widget").then((m) => m.reloadWidget()), 1500);
    return () => window.clearTimeout(t);
  }, [data.signature, game.done]);

  useEffect(() => {
    if (!inApp.current || !game.allDone) return;
    void import("@/lib/native/review").then((m) => m.maybeAskReview(data.date));
  }, [game.allDone, data.date]);

  return null;
}
