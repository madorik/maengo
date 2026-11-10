import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { lastCompleted, type ReportData, type ReportPeriod } from '@maengo/core/report';
import { db } from './db';
import { entitlements, type Profile } from './profile';

// 주간 리포트 읽기(2026-11-10, Premium. 월간은 뺐다). 만드는 쪽은 pipeline/src/reports.ts(스케줄러 08:00 KST, 화면의 '지금 만들기'는 api/report).
// reports 표가 없을 때(코드를 먼저 배포하고 마이그레이션 전)는 리포트가 없는 것으로 본다. 규칙은 맹고-문서/리포트.md.

export interface ReportEntry {
  start: string;
  status: 'ready' | 'empty';
}

export interface ReportView {
  period: ReportPeriod;
  start: string;
  data: ReportData;
}

/** 읽기 실패(표가 아직 없음 등)는 빈 값으로 */
function soft<T>(res: { data: unknown; error: { message: string } | null }, what: string, empty: T): T {
  if (res.error) {
    console.error(`[report] ${what}`, res.error.message);
    return empty;
  }
  return (res.data as T | null) ?? empty;
}

/** 이 종류 리포트 목록(최근 것부터, 시작일·상태만) */
export async function reportList(profile: Profile, period: ReportPeriod): Promise<ReportEntry[]> {
  const rows = soft(
    await db.from('reports').select('start_date,status').eq('user_id', profile.id).eq('period', period).order('start_date', { ascending: false }).limit(60),
    'reports list',
    [] as { start_date: string; status: 'ready' | 'empty' }[],
  );
  return rows.map((r) => ({ start: r.start_date, status: r.status }));
}

export async function reportOf(profile: Profile, period: ReportPeriod, start: string): Promise<ReportView | null> {
  const row = soft(
    await db.from('reports').select('data').eq('user_id', profile.id).eq('period', period).eq('start_date', start).eq('status', 'ready').maybeSingle(),
    'reports one',
    null as { data: ReportData } | null,
  );
  return row?.data?.v === 1 ? { period, start, data: row.data } : null;
}

/**
 * 화면의 '지금 만들기'로 만들 수 있는 기간의 첫날: 다 끝난 지난주.
 * 이미 있는지는 부르는 쪽이 본다(목록에 있으면 만들지 않는다)
 */
export function makeableStart(period: ReportPeriod, today = kstDate()): string | null {
  return lastCompleted(period, today);
}

/** 오늘 화면 안내 카드: 아직 열어 보지 않은 리포트 중 이레 안에 만든 것. Premium만 */
export async function freshReport(profile: Profile): Promise<{ period: ReportPeriod; start: string; headline: string } | null> {
  if (!entitlements(profile).reports) return null;
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const rows = soft(
    await db
      .from('reports')
      .select('period,start_date,headline:data->digest->>headline')
      .eq('user_id', profile.id)
      .eq('status', 'ready')
      .is('seen_at', null)
      .gte('created_at', since)
      .order('start_date', { ascending: false })
      .limit(1),
    'reports fresh',
    [] as { period: ReportPeriod; start_date: string; headline: string | null }[],
  );
  const r = rows[0];
  return r ? { period: r.period, start: r.start_date, headline: r.headline ?? '' } : null;
}

/** 리포트 화면에서 처음 열었다(오늘 화면 안내 카드를 거둔다) */
export async function markReportSeen(profile: Profile, period: ReportPeriod, start: string): Promise<void> {
  const { error } = await db
    .from('reports')
    .update({ seen_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .eq('period', period)
    .eq('start_date', start)
    .is('seen_at', null);
  if (error) console.error('[report] seen', error.message);
}
