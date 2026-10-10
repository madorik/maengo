// 맹고 앱(Capacitor 웹뷰)에서 온 요청인지. 앱은 User-Agent 끝에 "MaengoApp/<버전> (ios|android)"를 붙인다
// (apps/mobile/capacitor.config.ts). proxy.ts와 브라우저 코드가 같이 쓰므로 서버 전용 모듈을 import하지 않는다.
// 브라우저 코드에서 플러그인을 부를 때는 이것으로 거른 뒤 Capacitor.isNativePlatform()으로 한 번 더 본다.

export const APP_UA_MARK = "MaengoApp/";

export function isAppUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(APP_UA_MARK);
}
