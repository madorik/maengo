import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "./lib/session-cookie";

// 낙관적 가드: 쿠키가 있는지만 본다. 실제 확인은 (app)/layout의 requireProfile이 한다.
// 소개 페이지(/)는 누구나 볼 수 있는 정적 페이지라 여기서 다루지 않는다.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  let res: NextResponse;
  if (pathname === "/login") res = signedIn ? NextResponse.redirect(new URL("/today", request.url)) : NextResponse.next();
  else res = signedIn ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));

  // 로그인 힌트 쿠키를 세션과 맞춘다(예전에 로그인해 힌트가 없는 사람도)
  const hinted = request.cookies.has(SIGNED_IN_HINT);
  if (signedIn && !hinted) res.cookies.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn && hinted) res.cookies.delete(SIGNED_IN_HINT);
  return res;
}

export const config = {
  matcher: ["/login", "/today/:path*", "/article/:path*", "/listen/:path*", "/library/:path*", "/settings/:path*"],
};
