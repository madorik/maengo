import { isAppUserAgent } from "@/lib/app-client";

// 이 브라우저를 푸시 받을 기기로 등록한다(설정 > 알림을 켤 때). 브라우저에서만 부른다.
// 알림 권한 → 서비스 워커(public/push-sw.js) → Firebase로 FCM 토큰 → /api/devices에 저장. 보내기는 서버 스케줄러(pipeline/src/deliveries.ts).
// Firebase SDK는 무거워서 켤 때만 불러온다.

const SW_PATH = "/push-sw.js";
/** 이 브라우저가 등록한 토큰(서버 목록과 비교해 '이 브라우저도 받는지' 표시) */
const TOKEN_KEY = "maengo_push_token";

export type RegisterResult = { ok: true } | { ok: false; reason: "unsupported" | "denied" | "app" | "failed" };

export function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 이 브라우저가 지금 알림을 받을 수 있게 등록돼 있는지(권한 + 서버에 같은 토큰) */
export function registeredHere(serverTokens: string[]): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const t = storedToken();
  return !!t && serverTokens.includes(t);
}

export async function registerThisBrowser(): Promise<RegisterResult> {
  // 앱은 네이티브 푸시(@capacitor-firebase/messaging)로 등록한다. APP_PLAN.md 3단계에서 여기를 채운다
  if (isAppUserAgent(navigator.userAgent)) return { ok: false, reason: "app" };
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return { ok: false, reason: "unsupported" };
  if ((await Notification.requestPermission()) !== "granted") return { ok: false, reason: "denied" };
  try {
    await navigator.serviceWorker.register(SW_PATH);
    // 워커가 켜진 뒤에 토큰을 받아야 구독이 실패하지 않는다
    const registration = await navigator.serviceWorker.ready;
    const [{ getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
    if (!(await isSupported())) return { ok: false, reason: "unsupported" };
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
    const token = await getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, platform: "web" }),
    });
    if (!res.ok) return { ok: false, reason: "failed" };
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    return { ok: true };
  } catch (e) {
    console.error("[push] 등록 실패", e);
    return { ok: false, reason: "failed" };
  }
}
