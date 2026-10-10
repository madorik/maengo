import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "./lib/session-cookie";
import { readSession } from "./lib/session-token";

// 로그인 확인: 구글 로그인(Supabase 세션 쿠키)이나 데모 세션(서명한 쿠키) 중 하나면 로그인으로 본다.
// Supabase 토큰이 만료됐으면 여기서 갱신해 응답 쿠키에 다시 쓴다(서버 컴포넌트는 쿠키를 못 쓴다).
// 소개 페이지(/)는 누구나 볼 수 있는 정적 페이지라 여기서 다루지 않는다.
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
  const demo = (await readSession(raw)) !== null;
  const signedIn = supabaseUser || demo;

  const { pathname } = request.nextUrl;
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  let res = response;
  if (pathname === "/login" && signedIn) res = redirect("/today");
  else if (pathname !== "/login" && !signedIn) res = redirect("/login");

  if (raw && !demo) res.cookies.delete(SESSION_COOKIE);
  // 로그인 힌트 쿠키를 세션과 맞춘다(소개 페이지 버튼 문구용)
  const hinted = request.cookies.has(SIGNED_IN_HINT);
  if (signedIn && !hinted) res.cookies.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn && hinted) res.cookies.delete(SIGNED_IN_HINT);
  return res;
}

export const config = {
  matcher: ["/login", "/onboarding", "/today/:path*", "/article/:path*", "/listen/:path*", "/library/:path*", "/settings/:path*"],
};
