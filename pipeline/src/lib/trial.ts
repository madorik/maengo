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
