// 지난 소식 주소의 쪽·기간(?page=2&from=2026-11-01&to=2026-11-10, 날짜는 한국 날짜이고 둘 다 포함). 잘못된 값은 버린다.
// 기간을 고른 주소는 검색에 내지 않는다(noindex). 쪽만 넘긴 주소는 그대로 색인된다(맹고-문서/검색-노출.md)

export interface ArchiveQuery {
  page: number;
  from?: string;
  to?: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 'YYYY-MM-DD'이고 실제 있는 날만(2월 31일 같은 날은 버린다) */
function validDay(v: string | undefined): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v ? v : undefined;
}

export function parseArchiveQuery(sp: SearchParams): ArchiveQuery {
  const rawPage = one(sp.page);
  const page = rawPage && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  let from = validDay(one(sp.from));
  let to = validDay(one(sp.to));
  if (from && to && from > to) [from, to] = [to, from];
  return { page, from, to };
}

export const isFiltered = (q: ArchiveQuery) => !!(q.from || q.to);

export function archiveHref(base: string, q: ArchiveQuery): string {
  const sp = new URLSearchParams();
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  if (q.page > 1) sp.set("page", String(q.page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

const DAY = 24 * 3600_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** 오늘(한국 날짜) */
export const kstToday = (now = Date.now()) => iso(now + 9 * 3600_000);

/** 빠른 기간: 전체·이번 주(월요일부터)·이번 달·지난달. 지금까지인 기간은 끝 날을 비워 둔다(주소가 날마다 바뀌지 않게) */
export function archivePresets(today: string): { label: string; from?: string; to?: string }[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  const d = new Date(t);
  const monday = iso(t - ((d.getUTCDay() + 6) % 7) * DAY);
  const monthStart = today.slice(0, 8) + "01";
  const lastMonthEnd = iso(Date.parse(`${monthStart}T00:00:00Z`) - DAY);
  return [
    { label: "전체" },
    { label: "이번 주", from: monday },
    { label: "이번 달", from: monthStart },
    { label: "지난달", from: lastMonthEnd.slice(0, 8) + "01", to: lastMonthEnd },
  ];
}

/** '11월 1일', 올해가 아니면 '2025년 11월 1일' */
export function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${y !== Number(today.slice(0, 4)) ? `${y}년 ` : ""}${m}월 ${d}일`;
}

/** 고른 기간을 한 줄로: '11월 1일 ~ 11월 10일', '11월 1일부터', '11월 10일까지' */
export function rangeLabel(q: ArchiveQuery, today: string): string | null {
  if (q.from && q.to) return q.from === q.to ? shortDay(q.from, today) : `${shortDay(q.from, today)} ~ ${shortDay(q.to, today)}`;
  if (q.from) return `${shortDay(q.from, today)}부터`;
  if (q.to) return `${shortDay(q.to, today)}까지`;
  return null;
}

/** 쪽 번호 줄: 1 … 4 5 [6] 7 8 … 20 (null은 말줄임) */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const out: (number | null)[] = [];
  const lo = Math.max(1, page - 2);
  const hi = Math.min(pages, page + 2);
  if (lo > 1) out.push(1);
  if (lo > 2) out.push(null);
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push(null);
  if (hi < pages) out.push(pages);
  return out;
}
