import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAppUserAgent } from "./lib/app-client";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "./lib/session-cookie";
import { readSession } from "./lib/session-token";

// 로그인 확인: 구글 로그인(Supabase 세션 쿠키)이나 데모 세션(서명한 쿠키) 중 하나면 로그인으로 본다.
// 데모 세션은 운영 배포(VERCEL_ENV=production)에서는 보지 않고 쿠키를 지운다(lib/server/demo.ts와 같은 규칙).
// Supabase 토큰이 만료됐으면 여기서 갱신해 응답 쿠키에 다시 쓴다(서버 컴포넌트는 쿠키를 못 쓴다).
// 소개 페이지(/)는 누구나 볼 수 있는 정적 페이지라 여기서 다루지 않는다. 앱(User-Agent에 MaengoApp)만 예외로,
// 소개 대신 로그인 여부에 따라 /today·/login으로 보낸다. 브라우저 요청은 matcher에서 걸러져 이 함수를 타지 않는다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  let supabaseUser = false;
  if (request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    supabaseUser = !!data?.claims?.sub;
  }

  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const demo = process.env.VERCEL_ENV !== "production" && (await readSession(raw)) !== null;
  const signedIn = supabaseUser || demo;

  const { pathname } = request.nextUrl;
  const redirect = (to: string) => {
    // basePath(/maengo)를 붙인다. 같은 호스트면 Next가 상대 주소로 바꿔 보내서 watalabs.com에서 그대로 이어 간다
    const r = NextResponse.redirect(new URL(request.nextUrl.basePath + to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  let res = response;
  if (pathname === "/") {
    if (!isAppUserAgent(request.headers.get("user-agent"))) return response;
    res = redirect(signedIn ? "/today" : "/login");
  } else if (pathname === "/login" && signedIn) res = redirect("/today");
  else if (pathname !== "/login" && pathname !== "/contact" && !signedIn) res = redirect("/login");

  if (raw && !demo) res.cookies.delete(SESSION_COOKIE);
  // 로그인 힌트 쿠키를 세션과 맞춘다(소개 페이지 버튼 문구용)
  const hinted = request.cookies.has(SIGNED_IN_HINT);
  if (signedIn && !hinted) res.cookies.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn && hinted) res.cookies.delete(SIGNED_IN_HINT);
  return res;
}

export const config = {
  matcher: [
    "/login", "/onboarding", "/today/:path*", "/article/:path*", "/listen/:path*", "/library/:path*", "/settings/:path*", "/admin/:path*",
    // 문의하기 양식은 누구나 열지만, 로그인한 사람의 토큰을 갱신해 회원으로 알아보게 거친다
    "/contact",
    // 앱에서 연 소개 페이지만(lib/app-client.ts의 APP_UA_MARK와 같은 값이어야 한다. matcher는 상수만 된다)
    { source: "/", has: [{ type: "header", key: "user-agent", value: ".*MaengoApp/.*" }] },
  ],
};
