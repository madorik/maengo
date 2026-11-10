import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { APP_AUTH_CALLBACK } from "@/lib/app-client";
import { exchangeCode, readState, sealGcode, STATE_COOKIE } from "@/lib/server/google-login";
import { redirectInApp } from "@/lib/server/redirect";
import { signInWithGoogleIdToken } from "@/lib/server/sign-in";
import { keepYoutubeSections, youtubeSections } from "@/lib/server/youtube-interests";

// 구글 로그인에서 돌아오는 곳(lib/server/google-login.ts). 웹이면 바로 세션을 만들고,
// 앱(시스템 브라우저)이면 ID 토큰을 일회용 코드로 싸서 딥링크로 앱에 돌려준다. 앱 웹뷰가 /auth/callback?gcode=… 로 마무리한다.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = readState(params.get("state"));
  const code = params.get("code");
  if (!state) return redirectInApp("/login?error=oauth");

  if (state.f === "app") {
    const tokens = code ? await exchangeCode(state.o, code) : null;
    if (!tokens) return NextResponse.redirect(`${APP_AUTH_CALLBACK}?error=oauth`);
    const youtube = await youtubeSections(tokens.accessToken, tokens.scope);
    return NextResponse.redirect(`${APP_AUTH_CALLBACK}?gcode=${sealGcode(tokens.idToken, state.v, youtube)}`);
  }

  const jar = await cookies();
  const sameBrowser = jar.get(STATE_COOKIE)?.value === state.r;
  jar.delete(STATE_COOKIE);
  const tokens = sameBrowser && code ? await exchangeCode(state.o, code) : null;
  if (!tokens) return redirectInApp("/login?error=oauth");
  // 유튜브 구독으로 관심 분야를 찾았으면 온보딩이 소식 고르기를 건너뛴다(YOUTUBE_INTERESTS=1일 때만)
  await keepYoutubeSections(await youtubeSections(tokens.accessToken, tokens.scope));
  return signInWithGoogleIdToken(tokens.idToken);
}
