import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { supabaseAuth } from "@/lib/supabase/server";

// 구글·애플 로그인에서 돌아오는 곳. 코드를 세션으로 바꾸고, 처음이면 관심사 고르기로, 아니면 오늘 피드로 보낸다.
// 처음 로그인하면 Supabase 트리거가 프로필(플러스 체험 7일)을 만든다.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const fail = () => NextResponse.redirect(new URL("/login?error=oauth", request.url));
  if (!code) return fail();
  const supabase = await supabaseAuth();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] 로그인 실패", error?.message);
    return fail();
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE); // 데모 세션이 남아 있으면 지운다
  jar.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  const { data: profile } = await db.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(new URL(profile?.onboarded_at ? "/today" : "/onboarding", request.url));
}
