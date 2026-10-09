import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session-cookie";

// 낙관적 가드: 쿠키가 있는지만 본다. 실제 확인은 (app)/layout의 requireProfile이 한다.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/today", request.url)) : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/today/:path*", "/article/:path*", "/listen/:path*", "/library/:path*", "/settings/:path*"],
};
