import { addDays, kstDate } from '@maengo/core/kst';
import type { PushMessage } from './fcm';

// 무료 체험 끝 알림의 날짜·문구(DB를 읽지 않는 계산만, 테스트: __tests__/trial.test.ts). 보내기는 trial-reminder.ts.

/** 이 한국 날짜(YYYY-MM-DD) 하루의 시작·끝(ISO). 끝은 다음 날 0시(포함하지 않음) */
export function kstDayRange(date: string): { from: string; to: string } {
  return { from: new Date(`${date}T00:00:00+09:00`).toISOString(), to: new Date(`${addDays(date, 1)}T00:00:00+09:00`).toISOString() };
}

/** 내일 체험이 끝나 첫 결제가 되는 사람에게 보낼 알림. price는 동의할 때 본 스토어 표시 금액(예: ₩3,800), 모르면 null */
export function trialEndMessage(endsAt: string, price: string | null): PushMessage {
  const [, m, d] = kstDate(new Date(endsAt)).split('-').map(Number);
  return {
    title: '내일 무료 체험이 끝나요',
    body: price ? `${m}월 ${d}일에 Premium 첫 결제(${price})가 진행돼요` : `${m}월 ${d}일에 Premium 첫 결제가 진행돼요`,
    path: '/settings#plan',
  };
}

// ---- 체험 끝 알림 보내기의 시간 규칙(trial-reminder.ts) ----
// 스케줄러 실행은 300초에 끊긴다. 끊기면 가져간 사람(trial_reminders의 '보내는 중' 줄)이 알림을 못 받는다(2026-10-18 점검).
// 그래서 끝낼 시간이 있을 때만 새로 가져가고 다시 보내며, 모자라면 놓아줘 다음 실행(5분 뒤)이 잇는다.

/** 잠깐의 실패(429·5xx·인증·시간 초과)면 같은 실행에서 이만큼 기다렸다 다시 보낸다 */
export const TRIAL_RETRY_WAITS_MS = [3_000, 10_000];
/** 한 번 보내기(기기 토큰 읽기 + 인증 + 기기마다 FCM 요청, 요청마다 최대 10초 lib/fcm.ts)에 넉넉히 잡는 시간 */
export const TRIAL_PUSH_MS = 30_000;
/** 이만큼 넘게 '보내는 중'(result 없음)인 줄은 죽은 실행이 남긴 것으로 보고 넘겨받는다(함수는 300초에 끊기고, 스케줄러 잠금도 10분) */
export const TRIAL_PENDING_STALE_MS = 10 * 60_000;

/** 마감(deadline, ms) 전에 한 사람을 새로 가져가 한 번 보낼 시간이 있는지 */
export function trialMayStart(now: number, deadline: number): boolean {
  return deadline - now >= TRIAL_PUSH_MS;
}

/**
 * 한 번 보낸 뒤 다음 걸음. retries = 이미 다시 보낸 횟수.
 * done: 끝(보냄·기기 없음·다시 해도 같은 실패, 또는 다시 보내기를 다 씀). wait: 이만큼 기다렸다 다시. later: 기다렸다 보낼 시간이 없어 놓아준다(다음 실행이 처음부터)
 */
export function trialNextStep(status: string, retries: number, now: number, deadline: number): { do: 'done' } | { do: 'wait'; ms: number } | { do: 'later' } {
  if (status !== 'retry') return { do: 'done' };
  const ms = TRIAL_RETRY_WAITS_MS[retries];
  if (ms === undefined) return { do: 'done' };
  return now + ms + TRIAL_PUSH_MS > deadline ? { do: 'later' } : { do: 'wait', ms };
}
