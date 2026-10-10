import 'server-only';
import type { Persona, Plan, Voice } from '@maengo/core/types';
import type { Provider } from '../session-token';
import { db, must } from './db';

export interface Profile {
  id: string;
  displayName: string | null;
  provider: Provider;
  email: string | null;
  /** 애플 연동 전까지 쓰는 데모 계정으로 들어왔는지 */
  demo: boolean;
  /** 관심사 고르기를 마쳤는지. 안 마쳤으면 /onboarding으로 보낸다 */
  onboarded: boolean;
  notifyAt: string;
  plan: Plan;
  trialEndsAt: number | null;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProfileRow {
  id: string;
  display_name: string | null;
  notify_at: string;
  plan: Plan;
  trial_ends_at: string | null;
  persona: Persona;
  voice: Voice;
  auto_next: boolean;
  skip_read: boolean;
  onboarded_at: string | null;
}

export async function loadProfile(userId: string, who: { provider: Provider; email: string | null; demo: boolean }): Promise<Profile | null> {
  const row = must(
    await db.from('profiles').select('id,display_name,notify_at,plan,trial_ends_at,persona,voice,auto_next,skip_read,onboarded_at').eq('id', userId).maybeSingle(),
    'profiles',
  ) as ProfileRow | null;
  if (!row) return null;
  const trialEndsAt = row.trial_ends_at ? Date.parse(row.trial_ends_at) : null;
  // 체험이 끝났으면 무료로 본다(결제가 붙으면 결제 단계가 plan을 바꾼다)
  const plan: Plan = row.plan === 'trial' && trialEndsAt !== null && trialEndsAt < Date.now() ? 'free' : row.plan;
  return {
    id: row.id,
    displayName: row.display_name,
    ...who,
    onboarded: row.onboarded_at !== null,
    notifyAt: row.notify_at.slice(0, 5),
    plan,
    trialEndsAt,
    persona: row.persona,
    voice: row.voice,
    autoNext: row.auto_next,
    skipRead: row.skip_read,
  };
}

export function trialDaysLeft(p: Profile, now = Date.now()): number | null {
  if (p.plan !== 'trial' || !p.trialEndsAt) return null;
  return Math.max(0, Math.ceil((p.trialEndsAt - now) / DAY_MS));
}

/** PLAN.md 9.1 entitlements. 권한은 여기 한 곳에서만 판단한다. */
export function entitlements(p: Profile) {
  const paid = p.plan !== 'free';
  // 하루 소식 수: 무료 1개, 플러스·체험 최대 10개
  return { audio: paid, podcast: paid, pack: paid, topicLimit: paid ? 20 : 5, dailyItems: paid ? 10 : 1 };
}
