import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { APP_AUTH_CALLBACK } from "@/lib/app-client";

// 앱 로그인(APP_PLAN.md 2단계, 시스템 브라우저 + 딥링크). 로그인 화면이 앱 안에서만 불러온다(app/login/LoginButtons.tsx).
// 1) /api/auth/app이 로그인 주소를 주고 PKCE 쿠키를 웹뷰에 남긴다
// 2) 그 주소를 시스템 브라우저로 연다: iOS는 ASWebAuthenticationSession(NativeAuth.swift), 안드로이드는 Custom Tabs
// 3) kr.maengo.app://auth/callback?code=… 로 돌아오면 웹뷰에서 /auth/callback?code=… 를 열어 세션을 만든다

interface AuthSessionPlugin {
  start(options: { url: string; scheme: string }): Promise<{ url: string }>;
}
const AuthSession = registerPlugin<AuthSessionPlugin>("AuthSession");
const SCHEME = APP_AUTH_CALLBACK.slice(0, APP_AUTH_CALLBACK.indexOf(":"));

export type AppSignInResult = "ok" | "cancel" | "error";

export async function appSignIn(provider: "google" | "apple"): Promise<AppSignInResult> {
  let url: string;
  try {
    const res = await fetch("/api/auth/app", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
    if (!res.ok) return "error";
    url = ((await res.json()) as { url: string }).url;
  } catch {
    return "error";
  }
  const back = Capacitor.getPlatform() === "ios" ? await viaAuthSession(url) : await viaBrowser(url);
  if (back === null) return "cancel";
  if (back === "error") return "error";
  const code = new URL(back).searchParams.get("code");
  if (!code) return "error";
  // 서버가 쿠키를 쓰고 넘겨주는 라우트라 화면 전체를 넘긴다(클라이언트 라우팅이 아니라)
  window.location.assign(new URL(`/auth/callback?code=${encodeURIComponent(code)}`, window.location.origin).href);
  return "ok";
}

/** iOS: 사용자가 닫으면 null */
async function viaAuthSession(url: string): Promise<string | null | "error"> {
  try {
    return (await AuthSession.start({ url, scheme: SCHEME })).url;
  } catch (e) {
    return (e as { code?: string }).code === "canceled" ? null : "error";
  }
}

/** 안드로이드: Custom Tabs로 열고 딥링크(appUrlOpen)를 기다린다. 사용자가 닫으면 null */
function viaBrowser(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const handles: Promise<PluginListenerHandle>[] = [];
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      for (const h of handles) void h.then((x) => x.remove());
      if (value) void Browser.close().catch(() => {});
      resolve(value);
    };
    handles.push(
      App.addListener("appUrlOpen", ({ url: back }) => {
        if (back.startsWith(APP_AUTH_CALLBACK)) done(back);
      }),
    );
    // 브라우저가 닫혔다. 딥링크로 돌아오며 닫힌 것일 수도 있어 잠깐 기다린다
    handles.push(Browser.addListener("browserFinished", () => setTimeout(() => done(null), 1500)));
    Browser.open({ url }).catch(() => done(null));
  });
}
