import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { track } from "@/lib/analytics";
import { appLinkPath } from "@/lib/app-client";
import { stripBase } from "@/lib/base-path";
import { startAppPush } from "./push";

// 앱다운 마감(APP_PLAN.md 1단계). components/NativeShell.tsx가 앱 안에서만 불러온다.
// 플러그인의 네이티브 쪽은 apps/mobile에 같은 버전으로 설치돼 있어야 한다.

// 뒤로 가기로 앱을 내리는 첫 화면. 웹 기록이 남아 있어도 뒤로 가지 않는다.
// 로그인 뒤 기록에 /login이 남는데, 거기로 돌아가면 proxy가 다시 /today로 보내서 뒤로 가기가 먹지 않는 것처럼 보인다
const ROOT_PATHS = new Set(["/today", "/login", "/onboarding"]);

/** 실행 주소(위젯 딥링크)를 이미 따랐는지 */
const LAUNCH_KEY = "maengo:launch-url";

/** 알림·위젯으로 화면을 옮길 때 쓰는 Next 라우터(경로는 /maengo 없이) */
type ShellRouter = { push: (href: string) => void; refresh: () => void };

/** 앱 기능을 켜고, 끄는 함수를 돌려준다 */
export function startNativeShell(router: ShellRouter): () => void {
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
    // 시트·서랍(<dialog>). requestClose는 cancel 이벤트를 거쳐서 서랍처럼 닫는 애니메이션이 있는 창도 맞게 닫힌다(없는 웹뷰는 바로 닫기)
    const sheet = document.querySelector<HTMLDialogElement & { requestClose?: () => void }>("dialog[open]");
    if (sheet?.requestClose) sheet.requestClose();
    else if (sheet) sheet.close();
    else if (canGoBack && !ROOT_PATHS.has(stripBase(location.pathname))) history.back();
    else void App.minimizeApp();
  });

  // 개발 빌드: Capacitor가 실패한 플러그인 호출(결제 취소·실패 등)을 console.error로 찍어 Next 개발 오류 창이 뜬다.
  // 부른 쪽이 이미 처리하는 실패라 경고로만 남긴다(운영 앱은 Capacitor 로그가 꺼져 있고 오류 창도 없다)
  if (process.env.NODE_ENV !== "production") {
    type NativeResult = { success?: boolean; pluginId?: string; methodName?: string; error?: unknown };
    const cap = (window as unknown as { Capacitor?: { logFromNative?: (r: NativeResult) => void } }).Capacitor;
    if (cap?.logFromNative) {
      cap.logFromNative = (r) => {
        if (r.success === false) console.warn(`[${r.pluginId}.${r.methodName}]`, r.error);
      };
    }
  }

  // 알림·위젯이 연 화면으로 앱 안에서 옮긴다. 페이지를 통째로 다시 불러오면 듣던 음성이 끊기고, 안드로이드는 Capacitor가
  // HTML을 끝까지 받은 뒤에야 웹뷰에 넘겨서 그동안 화면이 멈춘 듯 보인다(2026-10-27 알림을 눌러 연 오늘 화면이 스크롤되지 않음).
  // 이미 그 화면이면 맨 위로. 옮기든 아니든 새로 받는다: 오늘 소식은 (app) 레이아웃(TodayProvider)이 들고 있어 화면만 옮기면 다시 읽지 않는다
  // (2026-10-28 새벽에 앱을 다른 화면에 둔 채 아침 알림을 눌렀더니 새벽에 받아 둔 빈 오늘이 보였다). 어디서 왔는지(?from=push|widget)는 주소에 남기지 않고 여기서 센다
  const go = (path: string) => {
    const url = new URL(path, location.origin);
    const from = url.searchParams.get("from");
    if (from === "push") track("push_open");
    if (from === "widget") track("widget_open");
    url.searchParams.delete("from");
    const to = url.pathname + url.search;
    if (to !== stripBase(location.pathname) + location.search) router.push(to);
    else window.scrollTo({ top: 0 });
    // 옮기기(push)가 끝난 뒤에 돈다(Next 라우터는 새로 받기를 앞선 이동 뒤에 줄 세운다)
    router.refresh();
  };

  // 앱 알림: 알림을 누르면 그 화면으로, 알림을 켠 기기면 토큰을 다시 등록(lib/native/push.ts)
  const stopPush = startAppPush(go);

  // 홈 화면 위젯을 누르면 kr.maengo.app://open/<화면>으로 앱이 열린다(1.3부터). 앱이 떠 있었으면 appUrlOpen으로,
  // 꺼져 있다 켜졌으면 실행 주소(getLaunchUrl)로 받는다. 실행 주소는 그 실행 내내 남아 있어서 화면을 새로 불러도 한 번만 따른다
  const openLink = (url: string) => {
    const path = appLinkPath(url);
    if (path) go(path);
  };
  const link = App.addListener("appUrlOpen", ({ url }) => openLink(url));
  void App.getLaunchUrl()
    .then((r) => {
      if (!r?.url || sessionStorage.getItem(LAUNCH_KEY) === r.url) return;
      sessionStorage.setItem(LAUNCH_KEY, r.url);
      openLink(r.url);
    })
    .catch(() => {});

  return () => {
    document.removeEventListener("click", onClick);
    void back.then((h) => h.remove());
    void link.then((h) => h.remove());
    stopPush();
  };
}
