// 맹고 앱(Capacitor 웹뷰)에서 온 요청인지. 앱은 User-Agent 끝에 "MaengoApp/<버전> (ios|android)"를 붙인다
// (apps/mobile/capacitor.config.ts). proxy.ts와 브라우저 코드가 같이 쓰므로 서버 전용 모듈을 import하지 않는다.
// 브라우저 코드에서 플러그인을 부를 때는 이것으로 거른 뒤 Capacitor.isNativePlatform()으로 한 번 더 본다.

export const APP_UA_MARK = "MaengoApp/";

export function isAppUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(APP_UA_MARK);
}

/** "… MaengoApp/1.2.0 (android)" → { version: "1.2.0", platform: "android" }. 앱이 아니면 null */
export function appInfoOf(ua: string | null | undefined): { version: string; platform: "ios" | "android" } | null {
  const m = ua?.match(/MaengoApp\/([\d.]+) \((ios|android)\)/);
  return m ? { version: m[1]!, platform: m[2] as "ios" | "android" } : null;
}

/** 문의 메일에 적을 기기(예: "Android 16 · Pixel 8", "iPhone · iOS 26.3"). 모르면 "알 수 없음" */
export function deviceOf(ua: string | null | undefined): string {
  if (!ua) return "알 수 없음";
  // "(Linux; Android 16; Pixel 8 Build/…; wv)": Android 다음 칸이 기종(줄인 UA는 "K"라 뺀다)
  const parts = (ua.match(/\(([^)]*)\)/)?.[1] ?? "").split(";").map((p) => p.trim());
  const at = parts.findIndex((p) => /^Android [\d.]+$/.test(p));
  if (at >= 0) {
    const model = parts[at + 1]?.replace(/ Build\/.*$/, "");
    return model && model !== "K" && model !== "wv" ? `${parts[at]} · ${model}` : parts[at]!;
  }
  const ios = ua.match(/(iPhone|iPad)[^)]*? OS ([\d_]+)/);
  if (ios) return `${ios[1]} · iOS ${ios[2]!.replace(/_/g, ".")}`;
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "알 수 없음";
}

/** 앱이 알림 받을 기기로 등록한 FCM 토큰(lib/native/push.ts). 있으면 이 앱 기기는 알림을 받는다 */
export const APP_PUSH_TOKEN_KEY = "maengo_app_push_token";

/** 이 앱 기기가 알림 받을 기기로 등록돼 있는지(앱 안에서만 의미가 있다) */
export function appPushRegisteredHere(): boolean {
  try {
    return !!localStorage.getItem(APP_PUSH_TOKEN_KEY);
  } catch {
    return false;
  }
}

/** 앱 로그인이 돌아오는 딥링크(apps/mobile: iOS NativeAuth.swift, 안드로이드 AndroidManifest의 intent-filter). Supabase 돌아올 주소 허용 목록에 kr.maengo.app://** 가 있어야 한다 */
export const APP_AUTH_CALLBACK = "kr.maengo.app://auth/callback";
