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
  | "bookmark"
  | "ask"
  | "purchase_start"
  | "purchase_complete"
  | "try_start"
  | "try_complete"
  | "try_trial_click"
  | "try_ask";

type Params = Record<string, string | number | boolean | null | undefined>;

/** GA4 맹고 속성의 측정 ID(GTM 안에 있는 것과 같다). window['ga-disable-<ID>']로 이 기기에서 보내기를 멈출 때 쓴다 */
export const GA4_MEASUREMENT_ID = "G-5FYPYJMVQ1";
/** 운영 주소. 이 밖(로컬·Vercel 미리보기)에서는 GTM을 싣지 않는다(components/Analytics.tsx) */
export const LIVE_HOSTS = ["watalabs.com", "www.watalabs.com"];
/** 내부 기기 표시(localStorage). 내부 계정으로 로그인하거나 ?internal=1로 열면 '1' */
export const INTERNAL_DEVICE_KEY = "maengo_internal";

/** 이 기기를 내부 기기로 표시하고 지금부터 GA4로 보내지 않는다(내부 계정으로 로그인했을 때, components/AnalyticsSession.tsx) */
export function markInternalDevice(): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`] = true;
  try {
    localStorage.setItem(INTERNAL_DEVICE_KEY, "1");
  } catch {}
}

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
