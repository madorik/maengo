import { kstDate } from '@maengo/core/kst';

// 배송·스케줄러의 다시 시도와 날짜 규칙(DB를 읽지 않는 계산만, 테스트: __tests__/retry.test.ts).

/** 푸시가 잠깐 실패했을 때(FCM 429·5xx·인증) 다시 보낼 간격(분). 다 쓰면 그날은 보내지 않는다 */
export const SEND_RETRY_MINUTES = [1, 5, 15];

/**
 * 푸시를 다시 보낼 시각. tries = 지금까지 잠깐 실패한 횟수(이번 포함).
 * 횟수를 다 썼거나 다시 보낼 때 그 소식 날짜(KST)가 지나 있으면 null(어제 소식을 '오늘의 소식'으로 알리지 않는다)
 */
export function sendRetryAt(tries: number, now: Date, date: string): Date | null {
  const min = SEND_RETRY_MINUTES[tries - 1];
  if (min === undefined) return null;
  const at = new Date(now.getTime() + min * 60_000);
  return kstDate(at) === date ? at : null;
}

/** 이만큼 앱을 열지 않은 사람은 배송이 새로 요약하지 않고 이미 요약된 소식으로만 만든다(알림은 보낸다) */
export const INACTIVE_DAYS = 7;

/** 일주일 넘게 앱을 열지 않았는지. 연 기록이 없으면 가입 시각으로 보고, 둘 다 모르면 활동 중으로 본다 */
export function isInactive(lastSeenAt: string | null | undefined, createdAt: string | null | undefined, now: Date): boolean {
  const at = Date.parse(lastSeenAt ?? createdAt ?? '');
  return Number.isFinite(at) && now.getTime() - at >= INACTIVE_DAYS * 24 * 3600_000;
}

// ---- 서버 스케줄러 작업(scheduler_tasks)이 실패했을 때 ----
// 예전엔 실패해도 주기만큼 미뤄서 06:00 수집이 실패하면 다음 날 06:00에야 다시 돌았다(죽거나 시간 초과는 10분 뒤 다시 가져가는데 거꾸로였다).

/** 실패한 작업을 다시 해 볼 간격 */
export const TASK_RETRY_MS = 30 * 60_000;
/** 하루(KST)에 다시 해 보는 횟수. 넘으면 원래 차례(다음 날 같은 시각)로 */
export const TASK_RETRIES = 3;

/** 실패를 이어 세려고 last_stats에 남기는 값 */
export interface TaskFailState {
  /** 실패를 센 날(KST) */
  failDate: string;
  /** 그날 실패 횟수 */
  fails: number;
  /** 원래 차례 시각(다시 시도로 next_run_at을 당겨도 이 시각에 맞춰 다음 차례를 정한다) */
  anchor: string;
  /** 다시 해 볼 시각. 더 하지 않으면 null */
  retryAt: string | null;
}

/** claim_scheduler_tasks가 돌려주는 줄 중 여기서 쓰는 칸 */
export interface TaskRow {
  every_minutes: number;
  next_run_at: string;
  last_status: string | null;
  last_stats: unknown;
}

/** 원래 차례(anchor)에서 주기만큼씩 민 시각 중 now 다음 것(finish_scheduler_task와 같은 계산) */
export function anchoredNext(anchor: string, everyMinutes: number, now: Date): Date {
  const period = everyMinutes * 60_000;
  const a = Date.parse(anchor);
  return new Date(a + (Math.max(0, Math.floor((now.getTime() - a) / period)) + 1) * period);
}

/** 지난 실행이 실패였으면 그때 남긴 실패 기록 */
export function prevFailure(t: TaskRow): TaskFailState | null {
  if (t.last_status !== 'failed') return null;
  const s = t.last_stats as Partial<TaskFailState> | null;
  return s && typeof s.failDate === 'string' && typeof s.fails === 'number' && typeof s.anchor === 'string' ? (s as TaskFailState) : null;
}

/**
 * 작업이 실패했다: 다음 차례와 남길 실패 기록. 30분 뒤 다시, 하루 세 번까지.
 * 주기가 그보다 짧은 작업(다시 시도가 원래 차례보다 늦는 것)은 원래 차례로 둔다
 */
export function afterTaskFailure(t: TaskRow, now: Date): { nextRunAt: Date; state: TaskFailState } {
  const prev = prevFailure(t);
  const today = kstDate(now);
  const anchor = prev?.anchor ?? t.next_run_at;
  const fails = prev && prev.failDate === today ? prev.fails + 1 : 1;
  const regular = anchoredNext(anchor, t.every_minutes, now);
  const retry = new Date(now.getTime() + TASK_RETRY_MS);
  const again = fails <= TASK_RETRIES && retry < regular;
  return { nextRunAt: again ? retry : regular, state: { failDate: today, fails, anchor, retryAt: again ? retry.toISOString() : null } };
}

/** 작업이 성공했다: 실패 뒤 다시 시도하던 중이었으면 원래 시각에 맞춘 다음 차례. 아니면 null(finish_scheduler_task가 정한다) */
export function afterTaskSuccess(t: TaskRow, now: Date): Date | null {
  const prev = prevFailure(t);
  return prev ? anchoredNext(prev.anchor, t.every_minutes, now) : null;
}
