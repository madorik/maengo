import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// 앱다운 마감(APP_PLAN.md 1단계). components/NativeShell.tsx가 앱 안에서만 불러온다.
// 플러그인의 네이티브 쪽은 apps/mobile에 같은 버전으로 설치돼 있어야 한다.

// 뒤로 가기로 앱을 내리는 첫 화면. 웹 기록이 남아 있어도 뒤로 가지 않는다.
// 로그인 뒤 기록에 /login이 남는데, 거기로 돌아가면 proxy가 다시 /today로 보내서 뒤로 가기가 먹지 않는 것처럼 보인다
const ROOT_PATHS = new Set(["/today", "/login", "/onboarding"]);

/** 앱 기능을 켜고, 끄는 함수를 돌려준다 */
export function startNativeShell(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  // 웹이 화면에 붙었으니 스플래시를 걷는다(웹을 못 불러오면 capacitor.config.ts 설정대로 3초 뒤 저절로 걷힌다)
  void SplashScreen.hide();

  // 바깥 링크(원문·유튜브)는 앱을 떠나지 않게 인앱 브라우저로 연다. 그냥 두면 Capacitor가 시스템 브라우저로 내보낸다
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!(a instanceof HTMLAnchorElement)) return;
    const url = new URL(a.href, location.href);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin === location.origin) return;
    e.preventDefault();
    void Browser.open({ url: url.href });
  };
  document.addEventListener("click", onClick);

  // 안드로이드 뒤로 가기: 열린 시트를 닫고 → 웹 기록이 있으면 뒤로 → 첫 화면이면 앱을 뒤로 보낸다.
  // 종료(exitApp) 대신 내려 두기(minimizeApp)는 안드로이드 12+의 기본 동작과 같고, 듣던 음성도 끊지 않는다
  const back = App.addListener("backButton", ({ canGoBack }) => {
    const sheet = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (sheet) sheet.close();
    else if (canGoBack && !ROOT_PATHS.has(location.pathname)) history.back();
    else void App.minimizeApp();
  });

  return () => {
    document.removeEventListener("click", onClick);
    void back.then((h) => h.remove());
  };
}
