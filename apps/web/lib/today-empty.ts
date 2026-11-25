import { scheduleDate, scheduleTask } from "@maengo/core/report";
import type { LibraryEntry } from "./types";

// 오늘 소식이 아직 없을 때 화면(2026-11-26 시안 '오늘 소식 오기 전')이 받는 값. 서버(lib/server/today-empty.ts)가 만들어 화면에 넘긴다.
// 서버·브라우저 어디서든 쓰는 모양만 둔다.

/** 남색 카드가 쓰는 값: 알림 시각(다음 브리핑·시간표), 알림을 켰는지, 내 관심사 이름, 서버가 그린 때 */
export interface EmptyPlan {
  /** 출근길·퇴근길 알림 시각 'HH:MM' */
  notifyAt: string;
  notifyAtPm: string;
  /** 푸시 알림을 켰는지(꺼 두면 '앱을 열면 받을 수 있어요'로 안내) */
  pushEnabled: boolean;
  /** 내 관심사 이름(내 관심 링크는 뺀다) */
  interests: string[];
  /** 브리핑 한 번에 고르는 소식 수(플랜의 하루 소식 수) */
  perBriefing: number;
  /** 서버가 이 화면을 그린 때(분 단위로 내린 ms). 브라우저가 처음 그릴 때도 같은 값으로 그려 서버 그림과 어긋나지 않게 한다 */
  nowMs: number;
}

/** '어제 못 본 소식': 직전 브리핑을 받은 날(어제 또는 그 앞)과 읽지도 듣지도 않은 소식(최대 3개) */
export interface EmptyMissed {
  /** '어제' 또는 '11월 24일' */
  dayLabel: string;
  entries: LibraryEntry[];
}

/** '다시 듣기': 직전 브리핑 하나 */
export interface EmptyReplay {
  /** '어제 퇴근길 브리핑' */
  title: string;
  /** 그 브리핑의 소식(보여 준 것만, 차례대로) */
  ids: number[];
  /** 그때 만든 오늘의 인사이트 제목. 없으면 null */
  headline: string | null;
}

/** '이번 주 챙겨 볼 일정' 한 줄: 주간 리포트(digest.next)에서 날짜를 읽은 앞으로의 일정 */
export interface EmptyEvent {
  month: number;
  day: number;
  /** 요일 이름(월~일) */
  weekday: string;
  title: string;
  /** 그 일정이 닿은 관심사 이름(최대 2개) */
  about: string[];
}

export interface EmptyData {
  plan: EmptyPlan;
  missed: EmptyMissed | null;
  replay: EmptyReplay | null;
  events: EmptyEvent[];
}

/** 주간 리포트에서 읽은 일정(digest.next)과 관심사 이름을 고르는 맞춤 체크(digest.personal). lib/server/report.ts latestSchedule */
export interface ScheduleInput {
  /** 그 리포트 주의 월요일 */
  start: string;
  next: { text: string; ids?: number[] }[];
  personal: { about: string; ids?: number[]; tally?: Record<string, number[]> }[];
}

/**
 * 가장 최근 주간 리포트의 일정 중 날짜를 읽을 수 있는 앞으로의 것(오늘 포함)을 날짜 순으로 최대 max개.
 * 날짜를 못 읽은 일정과 이미 지난 일정은 뺀다. 관심사는 그 일정의 근거 소식이 닿은 것(흐름을 바꾼 소식·쪽별 소식에 들어 있는 것) 최대 2개
 */
export function eventsOf(schedule: ScheduleInput, today: string, max = 2): EmptyEvent[] {
  const events: (EmptyEvent & { date: string })[] = [];
  for (const n of schedule.next) {
    const at = scheduleDate(n.text, schedule.start);
    if (!at || at.date < today) continue;
    const ids = n.ids ?? [];
    const about = schedule.personal
      .filter((p) => ids.some((x) => p.ids?.includes(x) || Object.values(p.tally ?? {}).some((list) => list.includes(x))))
      .map((p) => p.about)
      .slice(0, 2);
    events.push({ date: at.date, month: at.month, day: at.day, weekday: at.weekday, title: scheduleTask(n.text, true), about });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events.slice(0, max).map((e) => ({ month: e.month, day: e.day, weekday: e.weekday, title: e.title, about: e.about }));
}
