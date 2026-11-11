// 앱 설치 유도(2026-11-11). 웹으로 온 사람에게 앱이 확실히 나은 순간에만 앱을 권한다.
// - 휴대폰 웹의 로그인 전 화면 위 띠(components/app-install/AppBanner.tsx). iPhone 사파리는 애플 기본 배너(app/layout.tsx itunes)를 쓰고 띠는 숨긴다
// - PC 웹의 '휴대폰으로 받기' QR(소개 첫 화면, 로그인한 PC 왼쪽 메뉴). QR 그림은 public/qr/app-<자리>.svg(주소 /go/app?from=qr_<자리>)
// - 로그인한 휴대폰 웹: 알림을 켤 수 없을 때(설정 > 알림), 화면이 꺼져 브리핑 듣기가 멈췄을 때
// 누르면 /go/app?from=<자리>로 가고, 그 라우트가 기기를 보고 App Store·Play로 보낸다(app/go/app/route.ts).
// 서버·브라우저가 같이 쓴다(서버 전용 모듈을 import하지 않는다).
import { isAppUserAgent } from "@/lib/app-client";
import { withBase } from "@/lib/base-path";

export type MobileOs = "ios" | "android";

/** 휴대폰 운영체제(iPadOS는 맥으로 보여서 못 가른다). PC·모르면 null */
export function mobileOsOf(ua: string | null | undefined): MobileOs | null {
  if (!ua) return null;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/**
 * iPhone 사파리인지. 애플 기본 배너(apple-itunes-app)는 사파리에만 뜬다.
 * 카카오톡·네이버·인스타그램 안 브라우저와 iPhone의 Chrome·Firefox·Edge에는 안 떠서 직접 만든 띠를 보인다
 */
export function isIosSafari(ua: string): boolean {
  return mobileOsOf(ua) === "ios" && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|Whale/i.test(ua);
}

/** 앱을 권해도 되는 휴대폰 웹인지(앱 안·PC·홈 화면에 추가한 웹 앱은 아니다). 브라우저에서만 부른다 */
export function isMobileWeb(): boolean {
  const ua = navigator.userAgent;
  if (isAppUserAgent(ua) || !mobileOsOf(ua)) return false;
  return !window.matchMedia?.("(display-mode: standalone)").matches;
}

/** 앱 받기 주소. where는 GA4 app_install_click의 where와 같은 값(어느 자리에서 눌렀는지) */
export function installHref(where: string): string {
  return withBase(`/go/app?from=${encodeURIComponent(where)}`);
}

/** 닫은 뒤 다시 안 보이는 기간 */
const HIDE_DAYS = 7;

/** 이 자리 안내를 닫았거나 보여 준 지 7일이 안 됐는지. 저장소가 막혀 있으면 늘 보인다 */
export function hiddenRecently(key: string): boolean {
  try {
    const at = Number(localStorage.getItem(key));
    return !!at && Date.now() - at < HIDE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function hideFor7Days(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {}
}

// ---- 모든 앱 권유를 합친 횟수(2026-11-11 사용자: 자연스럽고 덜 귀찮게) ----
// 끼어드는 권유(로그인 전 띠, 듣기 멈춤, 다음 날 돌아왔을 때, 브리핑을 다 들었을 때)는 합쳐서 하루 한 번만 띄운다.
// 그중 두 번 닫으면 30일 동안 아무것도 띄우지 않는다. 늘 있는 자리(PC 왼쪽 QR, 설정의 한 줄, 리포트 맨 아래)는 세지 않는다.

const NUDGE_DAY_KEY = "maengo_app_nudge_day";
const NUDGE_CLOSED_KEY = "maengo_app_nudge_closed";
const REST_DAYS = 30;
const CLOSES_BEFORE_REST = 2;

const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

function closedRecord(): { n: number; at: number } {
  try {
    const [n, at] = (localStorage.getItem(NUDGE_CLOSED_KEY) ?? "").split("|").map(Number);
    return { n: n || 0, at: at || 0 };
  } catch {
    return { n: 0, at: 0 };
  }
}

/** 오늘 끼어드는 앱 권유를 띄워도 되는지(오늘 이미 띄웠거나, 두 번 닫고 30일이 안 지났으면 안 된다). 저장소가 막혀 있으면 된다 */
export function nudgeAllowed(): boolean {
  try {
    if (localStorage.getItem(NUDGE_DAY_KEY) === kstDay()) return false;
  } catch {
    return true;
  }
  const c = closedRecord();
  return !(c.n >= CLOSES_BEFORE_REST && Date.now() - c.at < REST_DAYS * 86_400_000);
}

/** 끼어드는 앱 권유를 띄웠다(오늘은 더 안 띄운다) */
export function markNudgeShown(): void {
  try {
    localStorage.setItem(NUDGE_DAY_KEY, kstDay());
  } catch {}
}

/** 앱 권유를 닫았다. 두 번째면 30일 쉰다(쉬고 나면 다시 0부터) */
export function markNudgeClosed(): void {
  const c = closedRecord();
  const rested = c.n >= CLOSES_BEFORE_REST && Date.now() - c.at >= REST_DAYS * 86_400_000;
  try {
    localStorage.setItem(NUDGE_CLOSED_KEY, `${rested ? 1 : c.n + 1}|${Date.now()}`);
  } catch {}
}

/** 앱으로 옮겨도 그대로라는 한 줄(옮길 때 다시 설정해야 한다는 걱정을 덜어 준다) */
export const SAME_ACCOUNT = "같은 구글·애플 계정으로 그대로 이어져요";
