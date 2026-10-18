// 브라우저에서 앱이 뜨기 전에 한 번 도는 파일(Next.js instrumentation-client). 가볍게 둔다.
// 화면 이동(링크·router.push·뒤로 가기)이 시작되면 알려서 맨 위 진행 바(NavProgress)가 차오르게 한다.
import * as Sentry from "@sentry/nextjs";
import { Capacitor } from "@capacitor/core";
import { sentryOptions } from "./lib/sentry-options";

export const NAV_START_EVENT = "maengo:nav-start";

// 앱(iOS·안드로이드)은 운영 웹을 띄우므로 같은 설정으로 앱 화면 오류도 잡힌다. 어디서 났는지는 platform 태그로 가른다
Sentry.init({
  ...sentryOptions,
  initialScope: { tags: { platform: Capacitor.getPlatform() } },
  // 고칠 수 없는 잡음: 자동 재생 거부·재생 중단, 끊긴 네트워크, 배포 직후 옛 화면의 파일 로딩 실패
  ignoreErrors: [
    "NotAllowedError",
    "AbortError",
    "The play() request was interrupted",
    "Load failed",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "ResizeObserver loop",
    "ChunkLoadError",
    "Loading chunk",
  ],
});

export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent(NAV_START_EVENT, { detail: url }));
}
