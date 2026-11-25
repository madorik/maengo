import type { BriefingSlot } from "@maengo/core/sections";

// 오늘 화면이 비었을 때 '다음 브리핑이 몇 분 뒤에 오는지'를 그리는 계산(2026-11-26 시안 '오늘 소식 오기 전').
// 모두 KST 기준이고, 브라우저 시간대와 관계없다. 서버와 브라우저가 같은 값으로 그리도록 분 단위로만 계산한다.

const MIN = 60_000;
const DAY_MIN = 24 * 60;
const KST_OFFSET_MS = 9 * 60 * MIN;

/** 'HH:MM' → 하루의 몇 번째 분(0~1439) */
export function minuteOf(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 시각(ms)의 KST 하루 중 몇 번째 분(0~1439) */
export function kstMinuteOfDay(ms: number): number {
  const dayMs = DAY_MIN * MIN;
  const inDay = (((ms + KST_OFFSET_MS) % dayMs) + dayMs) % dayMs;
  return Math.floor(inDay / MIN);
}

/** 분 단위로 내린 시각(ms). 화면이 1분마다만 바뀌게 하는 값 */
export const floorToMinute = (ms: number) => Math.floor(ms / MIN) * MIN;

/** 다가오는 브리핑 하나 */
export interface Upcoming {
  slot: BriefingSlot;
  /** 알림 시각 'HH:MM' */
  at: string;
  /** 지금부터 몇 분 뒤인지(0이면 이번 분) */
  inMin: number;
  /** 내일 오는 브리핑인지 */
  tomorrow: boolean;
}

/**
 * 지금 이후에 오는 브리핑 두 개(가까운 순). 출근길·퇴근길 알림 시각(amAt·pmAt)을 오늘과 내일에 놓고 지금 이후 것을 고른다.
 * 출근길 시각 전이면 [출근길, 퇴근길], 그 뒤 퇴근길 시각 전이면 [퇴근길, 내일 출근길], 퇴근길 시각 뒤면 [내일 출근길, 내일 퇴근길]
 */
export function upcomingBriefings(amAt: string, pmAt: string, nowMs: number): [Upcoming, Upcoming] {
  const now = kstMinuteOfDay(nowMs);
  const all = ([0, 1] as const).flatMap((day) =>
    (
      [
        ["am", amAt],
        ["pm", pmAt],
      ] as const
    ).map(([slot, at]) => ({ slot, at, atMin: minuteOf(at) + day * DAY_MIN, tomorrow: day === 1 })),
  );
  const [first, second] = all.filter((b) => b.atMin >= now).sort((a, b) => a.atMin - b.atMin);
  // 오늘·내일 네 칸 중 지금 이후가 항상 둘 이상 남는다(내일 두 칸은 모두 지금보다 뒤)
  const up = (b: NonNullable<typeof first>): Upcoming => ({ slot: b.slot, at: b.at, inMin: b.atMin - now, tomorrow: b.tomorrow });
  return [up(first!), up(second!)];
}

/** 'HH:MM' → '7:30', '18:00' (시는 두 자리로 채우지 않는다. 시간표 글자) */
export function clockText(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 하루의 몇 번째 분 → '6:40' */
export function minuteText(min: number): string {
  return clockText(`${Math.floor(min / 60)}:${min % 60}`);
}

/** 남은 분 → '50분 뒤에 와요' · '1시간 5분 뒤에 와요' · '3시간 뒤에 와요'. 0분이면 '곧 와요' */
export function remainingText(inMin: number): string {
  if (inMin <= 0) return "곧 와요";
  if (inMin < 60) return `${inMin}분 뒤에 와요`;
  const h = Math.floor(inMin / 60);
  const m = inMin % 60;
  return m ? `${h}시간 ${m}분 뒤에 와요` : `${h}시간 뒤에 와요`;
}
