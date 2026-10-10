import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SESSION_COOKIE } from '../session-cookie';
import { readSession } from '../session-token';
import { loadProfile, type Profile } from './profile';

/** 지금은 애플·구글 버튼 모두 Supabase 데모 계정(DEMO_USER_ID)으로 들어간다 */
export function demoUserId(): string {
  const id = process.env.DEMO_USER_ID?.trim();
  if (!id) throw new Error('DEMO_USER_ID가 없어요(pnpm --filter @maengo/pipeline seed:demo)');
  return id;
}

/** 로그인 안 했으면 null. 한 요청 안에서는 한 번만 읽는다 */
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return loadProfile(session.userId, session.provider);
});

export async function requireProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect('/login');
  return profile;
}
