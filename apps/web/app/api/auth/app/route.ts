import { NextResponse, type NextRequest } from "next/server";
import { APP_AUTH_CALLBACK } from "@/lib/app-client";
import { supabaseAuth } from "@/lib/supabase/server";

// 앱 로그인 시작(APP_PLAN.md 2단계, 시스템 브라우저 + 딥링크). 구글은 웹뷰 안 로그인을 막아서 앱은 로그인 주소를 시스템 브라우저로 연다.
// 여기서는 로그인 주소만 돌려주고, PKCE 검증 쿠키는 이 응답으로 웹뷰에 남긴다. 로그인이 끝나면 kr.maengo.app://auth/callback?code=… 로 앱에 돌아오고,
// 앱이 웹뷰에서 /auth/callback?code=… 를 열어 웹 로그인과 같은 방법으로 세션을 만든다(lib/native/auth.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
  const provider = body?.provider;
  if (provider !== "google" && provider !== "apple") return NextResponse.json({ error: "bad_request" }, { status: 400 });
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
