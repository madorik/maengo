import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '../session-cookie';
import { createDemoProfile, store, type Profile } from './store';

// 데모 세션 쿠키 값: 'demo:google' | 'demo:apple'. 유저는 하나(demo)다.
const DEMO_USER_ID = 'demo';

function parse(value: string | undefined): { userId: string; provider: 'apple' | 'google' } | null {
  const m = value?.match(/^demo:(apple|google)$/);
  return m ? { userId: DEMO_USER_ID, provider: m[1] as 'apple' | 'google' } : null;
}

export function sessionValue(provider: 'apple' | 'google'): string {
  return `demo:${provider}`;
}

/** 로그인 안 했으면 null. 개발 서버 재시작으로 메모리가 비었으면 데모 프로필을 다시 만든다. */
export async function currentProfile(): Promise<Profile | null> {
  const session = parse((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return store.profiles.get(session.userId) ?? createDemoProfile(session.userId, session.provider);
}

export async function requireProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect('/login');
  return profile;
}
