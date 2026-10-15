import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging, Importance } from "@capacitor-firebase/messaging";
import { APP_PUSH_TOKEN_KEY } from "@/lib/app-client";
import type { RegisterResult } from "@/lib/web-push";

// 앱 알림(안드로이드·iOS 네이티브 FCM, APP_PLAN.md 3단계). 웹 푸시(lib/web-push.ts)와 같은 /api/devices에 platform android·ios로 등록하고,
// 보내기는 같은 서버 스케줄러(pipeline/src/deliveries.ts)가 한다. 앱 안에서만 부른다.
// 플러그인의 네이티브 쪽은 apps/mobile에 같은 버전으로 설치돼 있어야 하고, iOS는 Firebase에 APNs 인증 키가 있어야 한다.

/** 이 기기가 등록한 토큰. 있으면 '알림을 켠 기기'로 보고 앱을 열 때마다 다시 등록한다 */
const TOKEN_KEY = APP_PUSH_TOKEN_KEY;
/** 계정은 알림을 켰는데 이 앱 기기는 아직 등록 전일 때, 권한을 한 번만 묻는다(거절하면 설정에서 직접 켠다) */
const ASKED_KEY = "maengo_app_push_asked";

const platform = () => (Capacitor.getPlatform() === "ios" ? "ios" : "android");
const appVersion = () => navigator.userAgent.match(/MaengoApp\/([\d.]+)/)?.[1];

function stored(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** 안드로이드 알림 채널(설정 > 알림에 '오늘의 맹고'로 보인다). AndroidManifest의 default_notification_channel_id와 같은 id */
async function ensureChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  await FirebaseMessaging.createChannel({ id: "daily", name: "오늘의 소식", description: "알림 시각에 오늘의 소식이 준비되면 알려요", importance: Importance.High }).catch(() => {});
}

async function save(token: string): Promise<boolean> {
  const res = await fetch("/api/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, platform: platform(), appVersion: appVersion() }),
  });
  if (res.ok) remember(token);
  return res.ok;
}

/** 알림 플러그인이 든 앱 빌드인지(예전 빌드는 같은 웹을 띄워도 플러그인이 없다) */
const available = () => Capacitor.isPluginAvailable("FirebaseMessaging");

/** 설정 > 알림을 켤 때: 알림 권한 → FCM 토큰 → 서버 등록 */
export async function registerApp(): Promise<RegisterResult> {
  if (!available()) return { ok: false, reason: "update" };
  try {
    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive !== "granted") perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== "granted") return { ok: false, reason: "denied" };
    await ensureChannel();
    const { token } = await FirebaseMessaging.getToken();
    return (await save(token)) ? { ok: true } : { ok: false, reason: "failed" };
  } catch (e) {
    console.error("[push] 앱 등록 실패", e);
    return { ok: false, reason: "failed" };
  }
}

/**
 * 다른 기기(웹 등)에서 알림을 켜 둔 계정으로 앱에 들어왔는데 이 앱 기기는 등록 전이면, 한 번 등록한다(권한을 한 번 묻는다).
 * 설정 > 알림 스위치는 계정 기준이라 이미 켜져 보여서, 이게 없으면 앱 기기는 영영 등록되지 않았다(2026-10-15)
 */
export async function registerAppOnce(): Promise<void> {
  if (!available() || stored()) return;
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    return;
  }
  await registerApp();
}

/** 알림을 끄면(서버는 그 사람의 토큰을 모두 지운다) 이 기기도 다시 등록하지 않게 잊는다 */
export function forgetApp() {
  remember(null);
}

/** 로그아웃할 때: 서버에서 이 기기 토큰을 지우고 기기 토큰도 버린다(다음 사람이 이 기기로 로그인해도 앞사람 알림이 오지 않게) */
export async function unregisterApp(): Promise<void> {
  if (!available()) return;
  const token = stored();
  if (token) {
    await fetch("/api/devices", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
  }
  await FirebaseMessaging.deleteToken().catch(() => {});
  remember(null);
}

/**
 * 앱을 열 때 켠다: 알림을 누르면 그 경로(data.path, 예: /today?from=push)로 가고, 토큰이 바뀌면 다시 등록한다.
 * 전에 알림을 켠 기기면 지금 토큰을 다시 등록해 last_seen_at을 갱신한다(권한을 새로 묻지는 않는다).
 */
export function startAppPush(navigate: (path: string) => void): () => void {
  if (!available()) return () => {};
  const handles = [
    FirebaseMessaging.addListener("notificationActionPerformed", (e) => {
      const path = (e.notification.data as { path?: unknown } | undefined)?.path;
      if (typeof path === "string" && path.startsWith("/")) navigate(path);
    }),
    FirebaseMessaging.addListener("tokenReceived", (e) => {
      if (stored()) void save(e.token).catch(() => {});
    }),
  ];
  void ensureChannel();
  if (stored()) {
    void FirebaseMessaging.checkPermissions()
      .then(async (p) => {
        if (p.receive === "granted") await save((await FirebaseMessaging.getToken()).token);
      })
      .catch(() => {});
  }
  return () => {
    for (const h of handles) void h.then((x) => x.remove());
  };
}
