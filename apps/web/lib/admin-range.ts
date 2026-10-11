import { addDays } from '@maengo/core/kst';

// 관리자 통계 기간(/admin?from=YYYY-MM-DD&to=YYYY-MM-DD). 날짜는 한국 시간, 양끝 포함.

/** 기간을 안 주면 오늘까지 14일 */
export const DEFAULT_DAYS = 14;
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
