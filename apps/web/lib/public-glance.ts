// 분야·주제 페이지의 '최근 30일 한눈에'(2026-11-26): 지난 30일 소식 수, 최근 4주 주별 소식 수, 여러 매체가 함께 다룬 소식 3개.
// 데이터로만 센다(AI 호출 없음). 날은 한국 날짜 기준이고 오늘을 0일 전으로 센다. 서버 읽기(lib/server/public-topics.ts의 digest)가 이 함수에 행을 넘긴다.

const DAY = 24 * 3600_000;
const KST = 9 * 3600_000;

/** 세는 기간(일) */
export const GLANCE_DAYS = 30;
/** 주별 막대는 오늘부터 7일씩 4주(28일) */
export const GLANCE_WEEKS = 4;
/** 소식이 이보다 적으면 칸을 숨긴다(얇은 칸이 나오지 않게) */
export const GLANCE_MIN_ITEMS = 3;
/** '여러 매체가 다룬' 소식으로 치는 최소 매체 수 */
export const GLANCE_MIN_OUTLETS = 2;
const TOP = 3;

export interface GlanceRow {
  clusterId: number;
  title: string;
  /** 맹고가 처음 본 때(기간·주 계산 기준, 소식 목록이 정렬하는 시각과 같다), ISO */
  firstSeenAt: string;
  /** 화면에 보이는 날짜(발행일, 없으면 처음 본 날), ISO */
  date: string;
  /** 이 소식을 다룬 공개 매체 수(같은 이름은 하나) */
  outlets: number;
}

export interface GlanceTop {
  clusterId: number;
  title: string;
  date: string;
  outlets: number;
}

export interface PublicMonth {
  /** 지난 30일 소식 수 */
  total: number;
  /** 주별 소식 수, 오래된 주부터 최근 주까지(마지막이 오늘부터 7일) */
  weeks: number[];
  /** 가장 많은 매체가 다룬 소식(매체 수 많은 순, 같으면 최근 순). 2곳 이상만 */
  top: GlanceTop[];
}

const dayIndex = (t: number) => Math.floor((t + KST) / DAY);

export function summarizeMonth(rows: GlanceRow[], now: number): PublicMonth | null {
  const today = dayIndex(now);
  const weeks = Array.from({ length: GLANCE_WEEKS }, () => 0);
  const inRange: GlanceRow[] = [];
  for (const r of rows) {
    const age = Math.max(0, today - dayIndex(Date.parse(r.firstSeenAt)));
    if (age >= GLANCE_DAYS) continue;
    inRange.push(r);
    if (age < GLANCE_WEEKS * 7) weeks[GLANCE_WEEKS - 1 - Math.floor(age / 7)]!++;
  }
  if (inRange.length < GLANCE_MIN_ITEMS) return null;
  const top = inRange
    .filter((r) => r.outlets >= GLANCE_MIN_OUTLETS)
    .sort((a, b) => b.outlets - a.outlets || Date.parse(b.date) - Date.parse(a.date) || b.clusterId - a.clusterId)
    .slice(0, TOP)
    .map(({ clusterId, title, date, outlets }) => ({ clusterId, title, date, outlets }));
  return { total: inRange.length, weeks, top };
}

/** 주 이름표(오래된 주부터): 3주 전, 2주 전, 1주 전, 최근 7일 */
export const weekLabels = (): string[] => Array.from({ length: GLANCE_WEEKS }, (_, i) => (i === GLANCE_WEEKS - 1 ? "최근 7일" : `${GLANCE_WEEKS - 1 - i}주 전`));
