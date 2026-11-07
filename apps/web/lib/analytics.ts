// 사용 패턴 분석(TODO.md 2번). 이벤트는 window.dataLayer에 쌓고, GTM(NEXT_PUBLIC_GTM_ID)이 GA4로 보낸다.
// GTM이 없으면(로컬·ID를 넣기 전) 쌓이기만 하고 아무 데도 가지 않는다. 이름·이메일·직접 적은 관심사 같은 개인정보는 넣지 않는다.
// 이벤트와 값의 뜻은 ANALYTICS.md에 있다(GTM에서 같은 이름으로 받는다).

export type AnalyticsEvent =
  | "identify"
  | "login_start"
  | "onboarding_complete"
  | "today_build"
  | "today_fill"
  | "item_open"
  | "source_open"
  | "listen_start"
  | "listen_complete"
  | "script_tab_open"
  | "feedback"
  | "topic_edit"
  | "link_edit"
  | "notify_toggle"
  | "push_open"
  | "widget_open"
  | "voice_change"
  | "more_receive"
  | "share"
  | "ask"
  | "purchase_start"
  | "purchase_complete"
  | "try_start"
  | "try_complete"
  | "try_trial_click"
  | "try_ask";

type Params = Record<string, string | number | boolean | null | undefined>;

/** 네이버 검색광고 전환으로도 보내는 이벤트(components/NaverAnalytics.tsx가 공통 스크립트를 실었을 때만 간다) */
const NAVER_CONVERSIONS: Partial<Record<AnalyticsEvent, string>> = { onboarding_complete: "sign_up" };

export function track(event: AnalyticsEvent, params: Params = {}): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[]; wcs?: { trans?: (conv: { type: string }) => void } };
  (w.dataLayer ??= []).push({ event, ...params });
  const naver = NAVER_CONVERSIONS[event];
  if (naver && w.wcs?.trans) {
    try {
      w.wcs.trans({ type: naver });
    } catch {}
  }
}

/** web · ios · android(앱은 User-Agent 끝의 "MaengoApp/<버전> (ios|android)") */
export function platformOf(ua: string): "web" | "ios" | "android" {
  const m = /MaengoApp\/[^ ]+ \((ios|android)\)/.exec(ua);
  return (m?.[1] as "ios" | "android" | undefined) ?? "web";
}
