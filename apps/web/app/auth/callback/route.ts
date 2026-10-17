import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { openGcode, VERIFIER_COOKIE } from "@/lib/server/google-login";
import { redirectInApp } from "@/lib/server/redirect";
import { afterSignIn, signInWithGoogleIdToken } from "@/lib/server/sign-in";
import { supabaseAuth } from "@/lib/supabase/server";

// 로그인에서 돌아오는 곳. 처음이면 관심사 고르기로, 아니면 오늘 피드로 보낸다(처음 로그인하면 Supabase 트리거가 프로필을 만든다).
// - code: Supabase OAuth(애플, 그리고 GOOGLE_DIRECT_LOGIN이 꺼져 있을 때 구글)의 PKCE 코드
// - gcode: 앱의 구글 로그인(lib/server/google-login.ts). 웹뷰에 심어 둔 확인값과 맞을 때만 세션을 만든다
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = () => redirectInApp("/login?error=oauth");

  const gcode = params.get("gcode");
  if (gcode) {
    const jar = await cookies();
    const idToken = openGcode(gcode, jar.get(VERIFIER_COOKIE)?.value);
    jar.delete(VERIFIER_COOKIE);
    return idToken ? signInWithGoogleIdToken(idToken) : fail();
  }

  const code = params.get("code");
  if (!code) return fail();
  const supabase = await supabaseAuth();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] 로그인 실패", error?.message);
    return fail();
  }
  return afterSignIn(data.user.id);
}
