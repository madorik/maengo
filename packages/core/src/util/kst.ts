// 모든 날짜 키는 KST 기준이다. 서버가 어느 시간대에서 돌든 결과가 같아야 한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function kstParts(now: Date) {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), wd: k.getUTCDay(), h: k.getUTCHours() };
}

/** 'YYYY-MM-DD'에 n일을 더한다(KST 날짜 문자열 그대로 계산) */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' */
export function kstDate(now: Date = new Date()): string {
  const { y, m, d } = kstParts(now);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** '10월 9일 목요일 아침' */
export function kstGreetingDate(now: Date = new Date()): string {
  const { m, d, wd, h } = kstParts(now);
  const part = h < 5 ? '새벽' : h < 11 ? '아침' : h < 17 ? '오후' : '저녁';
  return `${m}월 ${d}일 ${WEEKDAYS[wd]}요일 ${part}`;
}

function hourLabel(h: number): string {
  if (h === 0) return '밤 12시';
  if (h === 12) return '낮 12시';
  return `${h < 12 ? '오전' : '오후'} ${h % 12}시`;
}

/** 글 작성 시각 → '방금' | '오늘 오전 9시' | '어제 오후 3시' | '10월 6일' */
export function publishedLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (now.getTime() - at.getTime() < 60 * 60 * 1000) return '방금';
  const today = kstDate(now);
  const day = kstDate(at);
  const { h, m, d } = kstParts(at);
  if (day === today) return `오늘 ${hourLabel(h)}`;
  if (day === kstDate(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `어제 ${hourLabel(h)}`;
  return `${m}월 ${d}일`;
}

/** 피드 날짜 'YYYY-MM-DD' → '오늘' | '어제' | '10월 6일 화요일' */
export function kstDayLabel(date: string, now: Date = new Date()): string {
  const today = kstDate(now);
  if (date === today) return '오늘';
  if (date === kstDate(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return '어제';
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}

/** '07:00' → '아침 7시', '12:00' → '낮 12시', '21:30' → '밤 9시 30분' */
export function notifyTimeLabel(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const part = h < 12 ? '아침' : h === 12 ? '낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
  const hour = h <= 12 ? h : h - 12;
  return `${part} ${hour}시${m ? ` ${m}분` : ''}`;
}

/**
 * 알림 시간 선택지(KST): 아침 6시부터 밤 11시 30분까지 30분 단위.
 * 일일 배치가 새벽 4시에 돌아서 2시간 여유를 둔다. 알림 크론도 30분마다 돈다(PLAN.md 9.2).
 */
export const NOTIFY_TIMES: string[] = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 ? '30' : '00'}`;
});

export function isNotifyTime(v: unknown): v is string {
  return typeof v === 'string' && NOTIFY_TIMES.includes(v);
}
