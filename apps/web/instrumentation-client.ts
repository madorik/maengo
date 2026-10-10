// 브라우저에서 앱이 뜨기 전에 한 번 도는 파일(Next.js instrumentation-client). 가볍게 둔다.
// 화면 이동(링크·router.push·뒤로 가기)이 시작되면 알려서 맨 위 진행 바(NavProgress)가 차오르게 한다.
export const NAV_START_EVENT = "maengo:nav-start";

export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent(NAV_START_EVENT, { detail: url }));
}
