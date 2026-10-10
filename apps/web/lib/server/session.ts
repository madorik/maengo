import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SESSION_COOKIE } from '../session-cookie';
import { readSession } from '../session-token';
import { supabaseAuth } from '../supabase/server';
import { loadProfile, type Profile } from './profile';

/** 애플 연동 전까지 애플 버튼은 Supabase 데모 계정(DEMO_USER_ID)으로 들어간다 */
export function demoUserId(): string {
  const id = process.env.DEMO_USER_ID?.trim();
  if (!id) throw new Error('DEMO_USER_ID가 없어요(pnpm --filter @maengo/pipeline seed:demo)');
  return id;
}

/**
 * 로그인 안 했으면 null. 구글 로그인(Supabase 세션, JWT 검증)을 먼저 보고, 없으면 데모 세션을 본다.
 * 한 요청 안에서는 한 번만 읽는다.
 */
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await supabaseAuth();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (claims?.sub) {
    const provider = claims.app_metadata?.provider === 'apple' ? 'apple' : 'google';
    const meta = (claims.user_metadata ?? {}) as { avatar_url?: unknown; picture?: unknown };
    const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : null;
    return loadProfile(claims.sub, { provider, email: typeof claims.email === 'string' ? claims.email : null, avatarUrl: avatar, demo: false });
  }
  const demo = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (demo) return loadProfile(demo.userId, { provider: demo.provider, email: null, avatarUrl: null, demo: true });
  return null;
});

/**
 * 로그인한 사람. 이 함수가 도는 화면은 프록시가 이미 로그인으로 본 것이라, 여기서 사람이 없으면
 * 사용자가 지워진 오래된 세션이다. /login으로 보내면 프록시가 되돌려 끝없이 돌므로 쿠키를 지우는 곳으로 보낸다.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect('/auth/signout');
  return profile;
}

/** 앱 화면용: 관심사 고르기를 안 마쳤으면 먼저 그리로 보낸다 */
export async function requireOnboarded(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.onboarded) redirect('/onboarding');
  return profile;
}
