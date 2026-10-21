// 관리자 통계(/admin)가 탭마다 DB 함수(supabase/migrations/20261022100000_admin_tabs.sql)에서 받는 숫자와 화면 계산.
// DB를 읽지 않는 계산만(테스트: __tests__/admin-stats.test.ts).

/** 가입·활동 탭(admin_stats_growth) */
export interface GrowthStats {
  today: string;
  users: {
    total: number;
    /** 지금까지 온보딩을 마친 사람 전체 */
    onboarded: number;
    /** 기간에 가입한 사람 */
    signups: number;
    /** 기간에 온보딩을 마친 사람(가입은 더 전이어도) */
    onboardedInRange: number;
    /** 기간에 가입한 사람 중 온보딩을 마친 사람 */
    cohortOnboarded: number;
    /** 기간 가입자가 온보딩까지 걸린 시간(분) 중앙값 */
    onboardMedianMin: number | null;
    /** 지금 온보딩을 안 한 사람 */
    pending: number;
    pushOn: number;
  };
  activity: {
    active: number;
    /** 마지막 날(to) 활동한 사람 */
    dau: number;
    /** 마지막 날까지 30일 동안 활동한 사람 */
    mau: number;
    reads: number;
    listens: number;
    fed: number;
    /** 기간에 보낸 알림 */
    pushSent: number;
  };
  /** active = 그날 DAU, mau = 그날까지 30일, web·ios·android = 그날 그 플랫폼으로 앱을 연 사람 */
  daily: ({ date: string; signups: number; onboarded: number; active: number; mau: number; reads: number; listens: number } & Record<Platform, number>)[];
  /** 기간 가입자. 앞 단계를 지난 사람만 다음 단계로 센다. paid(결제)는 단계와 상관없이 */
  funnel: { signups: number; onboarded: number; fed: number; engaged: number; returned: number; paid: number };
  /** 가입 주(월요일)마다, 최근 주가 먼저. dN = 가입 N일 뒤 활동한 사람, dNBase = 그날이 다 지난 사람 */
  retention: RetentionRow[];
  features: { readers: number; listeners: number; playlist: number; links: number };
}

export type Platform = 'web' | 'ios' | 'android';

/** 매출·콘텐츠 탭(admin_stats_revenue) */
export interface RevenueStats {
  revenue: {
    /** 원화 결제 합(환불 뺌) */
    krw: number;
    /** 원화가 아닌 결제의 달러 합(환불 뺌) */
    usd: number;
    /** 금액을 아직 모르는 결제 수(웹훅 전) */
    unpriced: number;
    payers: number;
    /** 구독 결제(체험 빼고, 갱신 포함) */
    subscriptions: number;
    packs: number;
    packMaengo: number;
    refunds: number;
    trials: number;
    trialsEnded: number;
    trialsConverted: number;
    /** 지금 Premium */
    premium: number;
    /** 지금 Premium 중 스토어 구독 상태별(trial·active·past_due) */
    subs: Record<string, number>;
    cancelAtEnd: number;
    /** 기간 가입자와 그중 결제한 사람 */
    cohortSignups: number;
    cohortPaid: number;
  };
  wallet: { used: number; users: number; bought: number; gifted: number; clawback: number; balance: number };
  feedback: Record<string, number>;
  feedbackAll: Record<string, number>;
  content: { items: number; summaries: number; summariesTotal: number; topics: { id: string; name: string; custom: boolean; users: number }[] };
  cost: { geminiUsd: number; geminiMonthUsd: number; ttsMonthChars: number; voices: number };
}

/** 운영 탭(admin_stats_ops) */
export interface OpsStats {
  tasks: {
    name: string;
    enabled: boolean;
    everyMinutes: number;
    nextRunAt: string;
    runningSince: string | null;
    lastFinishedAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
  }[];
  deliveries: Record<string, number>;
  devices: Record<string, number>;
}

export interface RetentionRow {
  week: string;
  users: number;
  d1: number;
  d1Base: number;
  d7: number;
  d7Base: number;
  d30: number;
  d30Base: number;
}

/** 비율(0~1). 모수가 0이면 null */
export function ratio(n: number, base: number): number | null {
  return base > 0 ? n / base : null;
}

export interface FunnelStep {
  label: string;
  n: number;
  /** 가입 대비 */
  ofFirst: number | null;
  /** 앞 단계 대비(첫 단계는 null) */
  ofPrev: number | null;
}

export function funnelSteps(f: GrowthStats['funnel']): FunnelStep[] {
  const steps: [string, number][] = [
    ['가입', f.signups],
    ['온보딩', f.onboarded],
    ['첫 소식', f.fed],
    ['읽거나 들음', f.engaged],
    ['다시 옴', f.returned],
  ];
  return steps.map(([label, n], i) => ({ label, n, ofFirst: ratio(n, f.signups), ofPrev: i ? ratio(n, steps[i - 1]![1]) : null }));
}

/** 가입 주 줄을 모두 더한 합계 줄 */
export function retentionTotal(rows: RetentionRow[]): Omit<RetentionRow, 'week'> {
  const sum = (k: keyof Omit<RetentionRow, 'week'>) => rows.reduce((n, r) => n + r[k], 0);
  return { users: sum('users'), d1: sum('d1'), d1Base: sum('d1Base'), d7: sum('d7'), d7Base: sum('d7Base'), d30: sum('d30'), d30Base: sum('d30Base') };
}

/** 매출(원): 원화 결제 + 그 밖 통화의 달러 × 환율 */
export function revenueKrw(r: Pick<RevenueStats['revenue'], 'krw' | 'usd'>, krwPerUsd: number): number {
  return Math.round(r.krw + r.usd * krwPerUsd);
}

/** 걸린 시간(분): 1분 안 · N분 · N시간 · N일 */
export function durationLabel(min: number | null): string {
  if (min === null) return '—';
  if (min < 1) return '1분 안';
  if (min < 60) return `${Math.round(min)}분`;
  if (min < 48 * 60) return `${Math.round(min / 60)}시간`;
  return `${Math.round(min / 1440)}일`;
}
