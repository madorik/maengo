// 사용 패턴 분석(TODO.md 2번). 이벤트는 window.dataLayer에 쌓고, GTM(NEXT_PUBLIC_GTM_ID)이 GA4로 보낸다.
// GTM이 없으면(로컬·ID를 넣기 전) 쌓이기만 하고 아무 데도 가지 않는다. 이름·이메일·직접 적은 관심사 같은 개인정보는 넣지 않는다.
// 이벤트와 값의 뜻은 ANALYTICS.md에 있다(GTM에서 같은 이름으로 받는다).

export type AnalyticsEvent =
  | "identify"
  | "login_start"
  | "onboarding_complete"
  | "today_build"
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
  | "voice_change"
  | "more_receive"
  | "purchase_start"
  | "purchase_complete";

type Params = Record<string, string | number | boolean | null | undefined>;

export function track(event: AnalyticsEvent, params: Params = {}): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[] };
  (w.dataLayer ??= []).push({ event, ...params });
}

/** web · ios · android(앱은 User-Agent 끝의 "MaengoApp/<버전> (ios|android)") */
export function platformOf(ua: string): "web" | "ios" | "android" {
  const m = /MaengoApp\/[^ ]+ \((ios|android)\)/.exec(ua);
  return (m?.[1] as "ios" | "android" | undefined) ?? "web";
}
