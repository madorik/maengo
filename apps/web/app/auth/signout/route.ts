import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { supabaseAuth } from "@/lib/supabase/server";

// 세션 쿠키는 남았는데 사용자가 없을 때(계정을 지웠을 때 등) 쿠키를 모두 지우고 로그인 화면으로 보낸다.
// 프록시는 토큰 서명만 보므로 이런 세션도 로그인으로 본다. 그대로 /login에 보내면 프록시가 /today로 되돌려 끝없이 돈다.
// 이 경로는 프록시 matcher 밖이라 되돌려 보내지 않는다.
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuth();
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.warn("[auth] 로컬 로그아웃 실패, 쿠키만 지움:", (e as Error).message);
  }
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  return NextResponse.redirect(new URL("/login", request.url));
}
