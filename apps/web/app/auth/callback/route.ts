import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { openGcode, VERIFIER_COOKIE } from "@/lib/server/google-login";
import { redirectInApp } from "@/lib/server/redirect";
import { afterSignIn, signInWithGoogleIdToken } from "@/lib/server/sign-in";
import { supabaseAuth } from "@/lib/supabase/server";
import { keepYoutubeSections, youtubeSections } from "@/lib/server/youtube-interests";

// 로그인에서 돌아오는 곳. 처음이면 관심사 고르기로, 아니면 오늘 피드로 보낸다(처음 로그인하면 Supabase 트리거가 프로필을 만든다).
// - code: Supabase OAuth(애플, 그리고 GOOGLE_DIRECT_LOGIN이 꺼져 있을 때 구글)의 PKCE 코드
// - gcode: 앱의 구글 로그인(lib/server/google-login.ts). 웹뷰에 심어 둔 확인값과 맞을 때만 세션을 만든다
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = () => redirectInApp("/login?error=oauth");

  const gcode = params.get("gcode");
  if (gcode) {
    const jar = await cookies();
    const opened = openGcode(gcode, jar.get(VERIFIER_COOKIE)?.value);
    jar.delete(VERIFIER_COOKIE);
    if (!opened) return fail();
    await keepYoutubeSections(opened.youtube);
    return signInWithGoogleIdToken(opened.idToken);
  }

  const code = params.get("code");
  if (!code) return fail();
  const supabase = await supabaseAuth();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] 로그인 실패", error?.message);
    return fail();
  }
  // Supabase OAuth로 구글 로그인했으면 구글 접근 토큰(provider_token)으로 유튜브 구독을 읽는다(애플은 건너뛴다)
  if (data.user.app_metadata?.provider === "google") await keepYoutubeSections(await youtubeSections(data.session?.provider_token));
  return afterSignIn(data.user.id);
}
