import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { db } from './db';
import { redirectInApp } from './redirect';
import { AFTER_LOGIN_COOKIE, SESSION_COOKIE, SIGNED_IN_HINT } from '../session-cookie';
import { supabaseAuth } from '../supabase/server';

/**
 * 로그인이 끝난 뒤: 데모 세션을 지우고 로그인 힌트를 남긴 다음, 처음이면 관심사 고르기로, 아니면 오늘 피드로 보낸다.
 * 둘러보기에서 'Premium 무료 체험하기'를 누르고 왔으면 오늘 대신 요금제로(처음 온 사람은 관심사를 고른 뒤 completeOnboarding이 보낸다)
 */
export async function afterSignIn(userId: string): Promise<NextResponse> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.set(SIGNED_IN_HINT, '1', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
  const { data: profile } = await db.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle();
  if (!profile?.onboarded_at) return redirectInApp('/onboarding');
  return redirectInApp((await takeTrialIntent()) ? TRIAL_PATH : '/today');
}

/** 요금제에서 체험 안내 팝업을 바로 띄우는 주소(PremiumBuy autoTrial) */
export const TRIAL_PATH = '/premium?trial=1';

/** 둘러보기 끝에서 'Premium 무료 체험하기'를 누르고 왔는지. 왔으면 표시를 지우고 true(한 번만 쓴다) */
export async function takeTrialIntent(): Promise<boolean> {
  const jar = await cookies();
  if (jar.get(AFTER_LOGIN_COOKIE)?.value !== 'trial') return false;
  jar.delete(AFTER_LOGIN_COOKIE);
  return true;
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
