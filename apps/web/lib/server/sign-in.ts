import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { db } from './db';
import { redirectInApp } from './redirect';
import { SESSION_COOKIE, SIGNED_IN_HINT } from '../session-cookie';
import { supabaseAuth } from '../supabase/server';

/** 로그인이 끝난 뒤: 데모 세션을 지우고 로그인 힌트를 남긴 다음, 처음이면 관심사 고르기로, 아니면 오늘 피드로 보낸다 */
export async function afterSignIn(userId: string): Promise<NextResponse> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.set(SIGNED_IN_HINT, '1', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
  const { data: profile } = await db.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle();
  return redirectInApp(profile?.onboarded_at ? '/today' : '/onboarding');
}

/** 구글 ID 토큰으로 Supabase 세션을 만든다(lib/server/google-login.ts). 처음이면 Supabase 트리거가 프로필을 만든다 */
export async function signInWithGoogleIdToken(idToken: string): Promise<NextResponse> {
  const supabase = await supabaseAuth();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error || !data.user) {
    console.error('[auth] 구글 ID 토큰 로그인 실패', error?.message);
    return redirectInApp('/login?error=oauth');
  }
  return afterSignIn(data.user.id);
}
