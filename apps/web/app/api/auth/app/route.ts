import { NextResponse, type NextRequest } from "next/server";
import { APP_AUTH_CALLBACK } from "@/lib/app-client";
import { appCallbackOrigin, googleAuthUrl, googleDirectEnabled, hashToken, LOGIN_TTL_SEC, randomToken, signState, VERIFIER_COOKIE } from "@/lib/server/google-login";
import { supabaseAuth } from "@/lib/supabase/server";

// 앱 로그인 시작(APP_PLAN.md 2단계, 시스템 브라우저 + 딥링크). 구글은 웹뷰 안 로그인을 막아서 앱은 로그인 주소를 시스템 브라우저로 연다.
// 여기서는 로그인 주소만 돌려주고, 확인용 쿠키는 이 응답으로 웹뷰에 남긴다. 로그인이 끝나면 kr.maengo.app://auth/callback?… 로 앱에 돌아오고,
// 앱이 웹뷰에서 /auth/callback?… 를 열어 세션을 만든다(lib/native/auth.ts).
// - 구글(GOOGLE_DIRECT_LOGIN=1): 우리 도메인으로 받는다(lib/server/google-login.ts). 확인값 쿠키 + gcode
// - 애플(그리고 구글 직접 로그인이 꺼져 있을 때): Supabase OAuth. PKCE 검증 쿠키 + code
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
  const provider = body?.provider;
  if (provider !== "google" && provider !== "apple") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (provider === "google" && googleDirectEnabled()) {
    const origin = appCallbackOrigin(request.headers.get("origin"));
    const verifier = randomToken();
    const res = NextResponse.json({ url: googleAuthUrl(origin, signState({ f: "app", v: hashToken(verifier), o: origin })) }, { headers: { "cache-control": "no-store" } });
    res.cookies.set(VERIFIER_COOKIE, verifier, { httpOnly: true, secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: LOGIN_TTL_SEC });
    return res;
  }

  const supabase = await supabaseAuth();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: APP_AUTH_CALLBACK,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data.url) return NextResponse.json({ error: "oauth" }, { status: 500 });
  return NextResponse.json({ url: data.url }, { headers: { "cache-control": "no-store" } });
}
