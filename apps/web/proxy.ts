import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "./lib/session-cookie";
import { readSession } from "./lib/session-token";

// 세션 쿠키의 서명을 확인한다. 쿠키가 없거나 서명이 틀리면(예전 데모 쿠키 포함) 로그인 페이지로 보낸다.
// 소개 페이지(/)는 누구나 볼 수 있는 정적 페이지라 여기서 다루지 않는다.
export async function proxy(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = (await readSession(raw)) !== null;
  const { pathname } = request.nextUrl;
  let res: NextResponse;
  if (pathname === "/login") res = signedIn ? NextResponse.redirect(new URL("/today", request.url)) : NextResponse.next();
  else res = signedIn ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));

  if (raw && !signedIn) res.cookies.delete(SESSION_COOKIE);
  // 로그인 힌트 쿠키를 세션과 맞춘다(소개 페이지 버튼 문구용)
  const hinted = request.cookies.has(SIGNED_IN_HINT);
  if (signedIn && !hinted) res.cookies.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn && hinted) res.cookies.delete(SIGNED_IN_HINT);
  return res;
}

export const config = {
  matcher: ["/login", "/today/:path*", "/article/:path*", "/listen/:path*", "/library/:path*", "/settings/:path*"],
};
