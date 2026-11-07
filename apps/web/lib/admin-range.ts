import { addDays } from '@maengo/core/kst';

// 관리자 통계 기간(/admin?from=YYYY-MM-DD&to=YYYY-MM-DD). 날짜는 한국 시간, 양끝 포함.

/** 기간을 안 주면 오늘 하루(2026-11-08 사용자 결정, 예전엔 14일) */
export const DEFAULT_DAYS = 1;
/** 요약 탭 추이 그래프는 기간이 이보다 짧아도 끝날까지 이만큼(일) 그린다 */
export const TREND_MIN_DAYS = 30;
/** 한 번에 볼 수 있는 가장 긴 기간(일) */
export const MAX_DAYS = 366;

export interface AdminRange {
  from: string;
  to: string;
}

export interface AdminPreset extends AdminRange {
  label: string;
}

const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** 날짜 사이 일수(양끝 포함) */
export function spanDays({ from, to }: AdminRange): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** 주소의 from·to를 고친다. 잘못된 값은 버리고, 앞뒤가 바뀌면 바꾸고, 오늘 뒤는 오늘로, 너무 길면 to에서 MAX_DAYS만큼 */
export function parseAdminRange(sp: { from?: string | string[]; to?: string | string[] }, today: string): AdminRange {
  let to = isDate(sp.to) ? sp.to : today;
  let from = isDate(sp.from) ? sp.from : addDays(to, -(DEFAULT_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  if (spanDays({ from, to }) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
  return { from, to };
}

/** 요약 탭 추이 기간: 고른 기간이 TREND_MIN_DAYS보다 짧으면 끝날(to)까지 TREND_MIN_DAYS일 */
export function trendRange(range: AdminRange): AdminRange {
  const from = addDays(range.to, -(TREND_MIN_DAYS - 1));
  return { from: range.from < from ? range.from : from, to: range.to };
}

/** 관리자 탭(?tab=). 처음 여는 탭은 요약이라 주소에 넣지 않는다 */
export const ADMIN_TABS = [
  { id: 'summary', label: '요약' },
  { id: 'growth', label: '가입·활동' },
  { id: 'revenue', label: '매출·콘텐츠' },
  { id: 'ops', label: '운영' },
  { id: 'inquiries', label: '문의' },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]['id'];

export function parseAdminTab(sp: { tab?: string | string[] }): AdminTab {
  return ADMIN_TABS.find((t) => t.id === sp.tab)?.id ?? 'summary';
}

/** 탭·기간을 담은 /admin 주소. 요약 탭은 tab을 빼고 */
export function adminHref(tab: AdminTab, { from, to }: AdminRange): string {
  return `/admin?${tab === 'summary' ? '' : `tab=${tab}&`}from=${from}&to=${to}`;
}

export function adminPresets(today: string): AdminPreset[] {
  return [
    { label: '오늘', from: today, to: today },
    { label: '7일', from: addDays(today, -6), to: today },
    { label: '14일', from: addDays(today, -13), to: today },
    { label: '30일', from: addDays(today, -29), to: today },
    { label: '90일', from: addDays(today, -89), to: today },
    { label: '이번 달', from: `${today.slice(0, 8)}01`, to: today },
  ];
}
