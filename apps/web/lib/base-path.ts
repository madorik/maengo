import { MAENGO_BASE_PATH } from "@maengo/core/site";

// 맹고 웹은 watalabs.com/maengo 아래에서 돈다(next.config.ts basePath).
// Link·router·redirect()는 알아서 붙이지만, fetch·<audio src>·location·서비스 워커·라우트 핸들러 리다이렉트처럼
// 그냥 문자열로 쓰는 주소에는 직접 붙인다.
export const BASE_PATH = MAENGO_BASE_PATH;

/** "/api/x" → "/maengo/api/x". 첫 화면 "/"은 "/maengo"(Next가 끝 슬래시를 떼서 보낸다) */
export function withBase(path: string): string {
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

/** location.pathname("/maengo/today")을 앱 경로("/today")로 */
export function stripBase(pathname: string): string {
  if (pathname === BASE_PATH) return "/";
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
}
