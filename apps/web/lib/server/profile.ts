import 'server-only';
import { PERSONA } from '@maengo/core/audio';
import { dailyItemsFor } from '@maengo/core/plans';
import type { Persona, Plan, Voice } from '@maengo/core/types';
import type { Provider } from '../session-token';
import { db, must } from './db';

export interface Profile {
  id: string;
  displayName: string | null;
  provider: Provider;
  email: string | null;
  /** 구글 프로필 사진(애플·데모는 없음) */
  avatarUrl: string | null;
  /** 애플 연동 전까지 쓰는 데모 계정으로 들어왔는지 */
  demo: boolean;
  /** 관심사 고르기를 마쳤는지. 안 마쳤으면 /onboarding으로 보낸다 */
  onboarded: boolean;
  notifyAt: string;
  /** 푸시 알림을 켰는지(설정 > 알림). 꺼 두면 맹고는 만들어 두되 알리지 않는다 */
  pushEnabled: boolean;
  plan: Plan;
  /** Premium이 끝나는 시각(가입 1주일 또는 결제 기간). null이면 기한 없음 */
  premiumUntil: number | null;
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
  push_enabled: boolean;
  plan: Plan;
  premium_until: string | null;
  persona: Persona;
  voice: Voice;
  auto_next: boolean;
  skip_read: boolean;
  onboarded_at: string | null;
}

export async function loadProfile(
  userId: string,
  who: { provider: Provider; email: string | null; avatarUrl: string | null; demo: boolean },
): Promise<Profile | null> {
  const row = must(
    await db.from('profiles').select('id,display_name,notify_at,push_enabled,plan,premium_until,persona,voice,auto_next,skip_read,onboarded_at').eq('id', userId).maybeSingle(),
    'profiles',
  ) as ProfileRow | null;
  if (!row) return null;
  let premiumUntil = row.premium_until ? Date.parse(row.premium_until) : null;
  let plan: Plan = row.plan;
  // Premium 기한이 지났으면 Free로 돌린다(DB도 바로 고친다. 배치도 새벽마다 한꺼번에 돌린다)
  if (plan === 'plus' && premiumUntil !== null && premiumUntil < Date.now()) {
    plan = 'free';
    premiumUntil = null;
    const { error } = await db.from('profiles').update({ plan: 'free', premium_until: null }).eq('id', row.id).eq('plan', 'plus');
    if (error) console.error('Premium 만료 처리 실패', error.message);
  }
  return {
    id: row.id,
    displayName: row.display_name,
    ...who,
    onboarded: row.onboarded_at !== null,
    notifyAt: row.notify_at.slice(0, 5),
    pushEnabled: row.push_enabled,
    plan,
    premiumUntil,
    // 말투는 아나운서 하나로 고정(DB 값은 쓰지 않는다)
    persona: PERSONA,
    voice: row.voice,
    autoNext: row.auto_next,
    skipRead: row.skip_read,
  };
}

/** 이 사람이 웹 푸시로 등록한 토큰(설정 > 알림이 '이 브라우저도 받는지' 비교하는 데 쓴다) */
export async function webPushTokens(userId: string): Promise<string[]> {
  const rows = must(await db.from('device_tokens').select('token').eq('user_id', userId).eq('platform', 'web'), 'device_tokens') as { token: string }[];
  return rows.map((r) => r.token);
}

/** Premium 남은 날(기한이 있을 때만). 가입 1주일 Premium이면 7 → 0 */
export function premiumDaysLeft(p: Profile, now = Date.now()): number | null {
  if (p.plan !== 'plus' || !p.premiumUntil) return null;
  return Math.max(0, Math.ceil((p.premiumUntil - now) / DAY_MS));
}

/** PLAN.md 9.1 entitlements. 권한은 여기 한 곳에서만 판단한다. */
export function entitlements(p: Profile) {
  const paid = p.plan !== 'free';
  // 하루 소식 수: Free 1개, Premium 최대 10개
  return {
    audio: paid,
    podcast: paid,
    pack: paid,
    topicLimit: paid ? 20 : 5,
    dailyItems: dailyItemsFor(p.plan),
    // 기타(목록에 없어 직접 적은 관심사, custom 토픽) 개수. 목록 관심사와 따로 센다
    customLimit: paid ? 10 : 1,
  };
}
