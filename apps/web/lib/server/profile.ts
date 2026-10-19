import 'server-only';
import { PERSONA } from '@maengo/core/audio';
import type { PlanLimits } from '@maengo/core/plans';
import type { Persona, Plan, Voice } from '@maengo/core/types';
import type { Provider } from '../session-token';
import { db, must } from './db';
import { getPlans } from './plans';

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
  /** 이 플랜의 값(plans 표, 1분 캐시) */
  limits: PlanLimits;
  /** Premium이 끝나는 시각(스토어 구독 기간). null이면 기한 없음 */
  premiumUntil: number | null;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
  /** 재생 속도(1·1.2·1.5·0.8배) */
  playbackRate: number;
  /** 가입 시각(ms) */
  createdAt: number;
}


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
  playback_rate: number;
  onboarded_at: string | null;
  created_at: string;
}

/** 기한이 지난 Premium이 스토어에서 갱신됐는지 RevenueCat에서 다시 읽는다. 갱신됐으면 새 기한(ms), 아니거나 못 읽으면 null */
async function renewedUntil(userId: string): Promise<number | null> {
  // billing.ts가 지갑·구독 모듈을 끌고 와서 여기서만 불러온다
  const { billingConfigured, syncBilling } = await import('./billing');
  if (!billingConfigured()) return null;
  try {
    if ((await syncBilling(userId, 'renewal_check')).plan !== 'plus') return null;
    const row = must(await db.from('profiles').select('premium_until').eq('id', userId).single(), 'profiles') as { premium_until: string | null };
    const until = row.premium_until ? Date.parse(row.premium_until) : null;
    return until !== null && until > Date.now() ? until : null;
  } catch (e) {
    console.error('Premium 갱신 확인 실패', String((e as Error).message ?? e).slice(0, 200));
    return null;
  }
}

export async function loadProfile(
  userId: string,
  who: { provider: Provider; email: string | null; avatarUrl: string | null; demo: boolean },
): Promise<Profile | null> {
  // 플랜 값(plans 표, 1분 캐시)은 프로필과 나란히 읽는다(캐시가 비었을 때 차례로 두 번 오가지 않게)
  const [profileRes, plans] = await Promise.all([
    db.from('profiles').select('id,display_name,notify_at,push_enabled,plan,premium_until,persona,voice,auto_next,skip_read,playback_rate,onboarded_at,created_at').eq('id', userId).maybeSingle(),
    getPlans(),
  ]);
  const row = must(profileRes, 'profiles') as ProfileRow | null;
  if (!row) return null;
  let premiumUntil = row.premium_until ? Date.parse(row.premium_until) : null;
  let plan: Plan = row.plan;
  // Premium 기한이 지났으면 Free로 돌린다(DB도 바로 고친다. 배치도 새벽마다 한꺼번에 돌린다).
  // 스토어 자동 갱신은 웹훅이 오기 전에 기한이 지나 보일 수 있어서, 내리기 전에 RevenueCat에서 한 번 다시 읽는다
  if (plan === 'plus' && premiumUntil !== null && premiumUntil < Date.now()) {
    const renewed = await renewedUntil(row.id);
    if (renewed) premiumUntil = renewed;
    else {
      plan = 'free';
      premiumUntil = null;
      const { error } = await db.rpc('set_plan', { p_user: row.id, p_plan: 'free', p_until: null, p_reason: 'expiry', p_only_if: 'plus' });
      if (error) console.error('Premium 만료 처리 실패', error.message);
    }
  }
  return {
    id: row.id,
    displayName: row.display_name,
    ...who,
    onboarded: row.onboarded_at !== null,
    notifyAt: row.notify_at.slice(0, 5),
    pushEnabled: row.push_enabled,
    plan,
    limits: plans.get(plan)!,
    premiumUntil,
    // 말투는 아나운서 하나로 고정(DB 값은 쓰지 않는다)
    persona: PERSONA,
    voice: row.voice,
    autoNext: row.auto_next,
    skipRead: row.skip_read,
    // real(float4)이라 1.2가 1.2000000476…으로 올 수 있어 소수 둘째 자리로 맞춘다
    playbackRate: Math.round(row.playback_rate * 100) / 100,
    createdAt: Date.parse(row.created_at),
  };
}

/** 이 사람이 웹 푸시로 등록한 토큰(설정 > 알림이 '이 브라우저도 받는지' 비교하는 데 쓴다) */
export async function webPushTokens(userId: string): Promise<string[]> {
  const rows = must(await db.from('device_tokens').select('token').eq('user_id', userId).eq('platform', 'web'), 'device_tokens') as { token: string }[];
  return rows.map((r) => r.token);
}

/** 권한. 값은 plans 표(프로필을 읽을 때 붙여 둔 limits)에서 온다. 권한은 여기 한 곳에서만 판단한다 */
export function entitlements(p: Profile) {
  const l = p.limits;
  return {
    audio: l.audio,
    topicLimit: l.topicLimit,
    /** 하루 맹고(하루에 받는 소식 수). 더 받기는 지갑에서 */
    dailyItems: l.dailyItems,
    // 기타(목록에 없어 직접 적은 관심사, custom 토픽) 개수. 목록 관심사와 따로 센다. Free가 전에 넣은 건 그대로 둔다
    customLimit: l.customLimit,
    /** 내 관심 링크(블로그·사이트 RSS) 개수. 0이면 못 넣는다(Premium 배지) */
    linkLimit: l.linkLimit,
    canBuyMaengo: l.canBuyMaengo,
    archiveDays: l.archiveDays,
  };
}
