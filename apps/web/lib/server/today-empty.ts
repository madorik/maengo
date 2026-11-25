import 'server-only';
import { addDays, kstDate } from '@maengo/core/kst';
import { SLOT_LABEL } from '@maengo/core/sections';
import { floorToMinute } from '../briefing-clock';
import { eventsOf, type EmptyData, type EmptyMissed } from '../today-empty';
import { getLibrary, lastBriefing, todayHasRows } from './feed';
import { entitlements, type Profile } from './profile';
import { latestSchedule } from './report';
import { userTopics } from './topics';

// 오늘 소식이 아직 없을 때 화면의 '기다리는 동안' 칸들(2026-11-26 시안): 내 관심사(남색 카드), 어제 못 본 소식, 다시 듣기, 이번 주 챙겨 볼 일정.
// 모두 이미 있는 조회(보관함·피드·리포트·관심사)를 재사용하고, 어느 하나가 실패해도 오늘 화면이 막히지 않게 그 칸만 비운다.

/** 읽기 실패는 그 칸만 비운다(오늘 화면의 나머지는 그대로) */
async function soft<T>(job: Promise<T> | T, what: string, empty: T): Promise<T> {
  try {
    return await job;
  } catch (e) {
    console.error(`[today-empty] ${what}`, String((e as Error)?.message ?? e).slice(0, 200));
    return empty;
  }
}

/** 'YYYY-MM-DD' → '어제' 또는 '11월 24일' */
function dayLabel(date: string, today: string): string {
  return date === addDays(today, -1) ? '어제' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

/** 어제(직전 브리핑을 받은 날) 못 본 소식 최대 3개: 보관함 '안 읽음' 첫 쪽에서 그날 것만 */
const MISSED_MAX = 3;
/** 일정은 두 개까지 */
const EVENTS_MAX = 2;

/**
 * 오늘 화면이 비어 있을 때만 읽는다(보여 줄 소식이 있으면 null: 아무것도 읽지 않는다).
 * 못 본 소식·다시 듣기는 직전 브리핑을 받은 날 기준이고, 일정은 Premium 가장 최근 주간 리포트에서 날짜를 읽을 수 있는 앞으로의 것만
 */
export async function todayEmptyData(profile: Profile): Promise<EmptyData | null> {
  if (await todayHasRows(profile)) return null;
  return loadEmptyData(profile);
}

/** 비었는지 보지 않고 칸들을 읽는다(todayEmptyData가 비었을 때만 부른다) */
export async function loadEmptyData(profile: Profile): Promise<EmptyData> {
  const today = kstDate();
  const [topics, last, lib, schedule] = await Promise.all([
    soft(userTopics(profile), '관심사', []),
    soft(lastBriefing(profile), '직전 브리핑', null),
    // 오늘 피드는 비어 있으니 읽어 맞출 것이 없다(syncToday false). 안 읽은 소식 첫 쪽(10개)만 받는다
    soft(getLibrary(profile, { page: 1, section: null, read: 'unread', syncToday: false }), '못 본 소식', null),
    entitlements(profile).reports ? soft(latestSchedule(profile), '주간 리포트 일정', null) : null,
  ]);

  let missed: EmptyMissed | null = null;
  const group = last && lib?.groups.find((g) => g.date === last.date);
  if (last && group?.entries.length) missed = { dayLabel: dayLabel(last.date, today), entries: group.entries.slice(0, MISSED_MAX) };

  return {
    plan: {
      notifyAt: profile.notifyAt,
      notifyAtPm: profile.notifyAtPm,
      pushEnabled: profile.pushEnabled,
      interests: topics.filter((t) => !t.link).map((t) => t.name),
      perBriefing: entitlements(profile).dailyItems,
      nowMs: floorToMinute(Date.now()),
    },
    missed,
    replay: last ? { title: `${dayLabel(last.date, today)} ${SLOT_LABEL[last.slot]} 브리핑`, ids: last.ids, headline: last.headline } : null,
    events: schedule ? eventsOf(schedule, today, EVENTS_MAX) : [],
  };
}
