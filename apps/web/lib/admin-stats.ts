// 관리자 통계(/admin)가 탭마다 DB 함수(supabase/migrations/20261022100000_admin_tabs.sql)에서 받는 숫자와 화면 계산.
// DB를 읽지 않는 계산만(테스트: __tests__/admin-stats.test.ts).

/** 달러를 원으로 셀 때 환율(운영비와-가격.md 전제와 같다) */
export const KRW_PER_USD = 1400;

/** 요약 탭(admin_stats_summary, supabase/migrations/20261108120000_admin_summary.sql). 추이 기간의 날마다 값과 그 전까지의 누적 */
export interface SummaryStats {
  /** 로그인 안 한 방문자를 세기 시작한 날(guest_visits 첫 날). 아직 없으면 null */
  firstVisit: string | null;
  /** 추이 첫날 전까지: 가입한 회원, 매출(원화·그 밖 통화 달러), API 비용(달러) */
  base: { users: number; krw: number; usd: number; costUsd: number };
  /** subs = 그날 끝(오늘은 지금)에 유료 구독 기간 안인 사람. 나머지는 그날 생긴 수 */
  daily: { date: string; visitors: number; signups: number; newSubs: number; trials: number; subs: number; krw: number; usd: number; costUsd: number }[];
}

/** 요약 탭 하루. 돈은 원(달러는 환율로) */
export interface SummaryDay {
  date: string;
  visitors: number;
  signups: number;
  /** 그날 끝 전체 회원 */
  users: number;
  newSubs: number;
  trials: number;
  subs: number;
  revenue: number;
  revenueTotal: number;
  cost: number;
  costTotal: number;
}

/** 날마다 값에 누적(전체 회원·전체 매출·누적 지출)을 붙인다. 돈은 원으로 반올림(누적은 반올림 전 값을 더해서) */
export function summarySeries(s: SummaryStats, krwPerUsd = KRW_PER_USD): SummaryDay[] {
  let users = s.base.users;
  let revenue = s.base.krw + s.base.usd * krwPerUsd;
  let cost = s.base.costUsd * krwPerUsd;
  return s.daily.map((d) => {
    const dayRevenue = d.krw + d.usd * krwPerUsd;
    const dayCost = d.costUsd * krwPerUsd;
    users += d.signups;
    revenue += dayRevenue;
    cost += dayCost;
    return {
      date: d.date,
      visitors: d.visitors,
      signups: d.signups,
      users,
      newSubs: d.newSubs,
      trials: d.trials,
      subs: d.subs,
      revenue: Math.round(dayRevenue),
      revenueTotal: Math.round(revenue),
      cost: Math.round(dayCost),
      costTotal: Math.round(cost),
    };
  });
}

/** 고른 기간의 요약 숫자. 전환율은 방문자를 센 날(firstVisit부터)의 가입 ÷ 방문자. 전체 값은 기간 마지막 날 */
export function summaryTotals(days: SummaryDay[], range: { from: string; to: string }, firstVisit: string | null) {
  const inRange = days.filter((d) => d.date >= range.from && d.date <= range.to);
  const tracked = firstVisit ? inRange.filter((d) => d.date >= firstVisit) : [];
  const sum = (list: SummaryDay[], k: 'visitors' | 'signups' | 'newSubs' | 'trials') => list.reduce((n, d) => n + d[k], 0);
  const last = inRange.at(-1);
  const visitors = sum(tracked, 'visitors');
  const trackedSignups = sum(tracked, 'signups');
  return {
    visitors,
    trackedSignups,
    conversion: tracked.length ? ratio(trackedSignups, visitors) : null,
    signups: sum(inRange, 'signups'),
    users: last?.users ?? 0,
    newSubs: sum(inRange, 'newSubs'),
    trials: sum(inRange, 'trials'),
    subs: last?.subs ?? 0,
    revenue: inRange.reduce((n, d) => n + d.revenue, 0),
    revenueTotal: last?.revenueTotal ?? 0,
    cost: inRange.reduce((n, d) => n + d.cost, 0),
    costTotal: last?.costTotal ?? 0,
  };
}

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
  cost: { geminiUsd: number; geminiMonthUsd: number; openaiUsd?: number; openaiMonthUsd?: number; ttsMonthChars: number; voices: number };
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
