import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { APP_AUTH_CALLBACK } from "@/lib/app-client";
import { exchangeCode, readState, sealGcode, STATE_COOKIE } from "@/lib/server/google-login";
import { redirectInApp } from "@/lib/server/redirect";
import { signInWithGoogleIdToken } from "@/lib/server/sign-in";

// 구글 로그인에서 돌아오는 곳(lib/server/google-login.ts). 웹이면 바로 세션을 만들고,
// 앱(시스템 브라우저)이면 ID 토큰을 일회용 코드로 싸서 딥링크로 앱에 돌려준다. 앱 웹뷰가 /auth/callback?gcode=… 로 마무리한다.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = readState(params.get("state"));
  const code = params.get("code");
  if (!state) return redirectInApp("/login?error=oauth");

  if (state.f === "app") {
    const idToken = code ? await exchangeCode(state.o, code) : null;
    return NextResponse.redirect(idToken ? `${APP_AUTH_CALLBACK}?gcode=${sealGcode(idToken, state.v)}` : `${APP_AUTH_CALLBACK}?error=oauth`);
  }

  const jar = await cookies();
  const sameBrowser = jar.get(STATE_COOKIE)?.value === state.r;
  jar.delete(STATE_COOKIE);
  const idToken = sameBrowser && code ? await exchangeCode(state.o, code) : null;
  return idToken ? signInWithGoogleIdToken(idToken) : redirectInApp("/login?error=oauth");
}
