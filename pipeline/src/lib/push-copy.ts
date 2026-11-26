import { mapLimit } from './limit';

// 출근길·퇴근길 알림 문구(2026-11-19 사용자: 뉴스 제목이 아니라 그 사람이 관심 가질 내용으로,
// 2026-11-26 사용자: 딱 봐도 궁금해할 한 줄로). 잠금 화면에서 가장 먼저 보이는 굵은 제목에 그 한 줄을 둔다
// (전엔 제목이 늘 '출근길 소식이 도착했어요'였고, 본문은 보안 공지 같은 확인할 것이 먼저라 누구에게나 같은 경고처럼 보였다).
// 오늘의 흐름(웹 쪽 lib/server/briefing-insight.ts)이 같은 호출에서 알림 한 줄(push)을 만들어 두니 그것을 쓴다.
// DB·AI를 직접 부르지 않는 계산만 둔다(흐름은 콜백으로 받는다). 테스트: __tests__/push-copy.test.ts

/** 알림에 쓸 오늘의 흐름의 일부 */
export interface PushInsight {
  /** 오늘의 흐름 큰 제목(앱 오늘 화면 맨 위와 같은 글) */
  headline: string;
  /** 큰 제목이 닿는 회원 사정의 꼬리표. 비면 오늘 소식 가운데 그 사람 사정에 닿는 게 없다 */
  about: string;
  /** 알림 한 줄(궁금해서 열어 보게 하는 줄, 24자 안팎). 형식 16 이전에 만든 흐름이나 거르기에 걸리면 없다 */
  hook?: string;
}

/** 알림 제목 글자 수 상한(잠금 화면 한 줄). 넘으면 줄임표로 자른다 */
export const TITLE_MAX = 32;

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const clamp = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * 알림 제목 = 궁금해서 열어 보게 하는 한 줄. 알림 한 줄(hook)이 먼저, 없으면 오늘의 흐름 큰 제목.
 * 둘 다 없으면 null → 호출한 쪽이 그 브리핑 첫 소식 제목으로 보낸다
 */
export function pushTitle(insight: PushInsight | null | undefined): string | null {
  if (!insight) return null;
  const line = clean(insight.hook) || clean(insight.headline);
  return line ? clamp(line, TITLE_MAX) : null;
}

/** 알림 본문(둘째 줄): 어느 브리핑인지와 소식 수만. 제목의 답을 미리 말하지 않는다 */
export function pushBody(slot: Slot, count: number): string {
  return `${slot === 'pm' ? '퇴근길' : '출근길'} 브리핑 · 소식 ${count}개`;
}

/** 흐름이 없을 때 제목으로 쓸 첫 소식 제목(공백 정리·길이 자르기) */
export function fallbackTitle(firstNewsTitle: string | null | undefined): string | null {
  const t = clean(firstNewsTitle ?? '');
  return t ? clamp(t, TITLE_MAX) : null;
}

export type Slot = 'am' | 'pm';
export type InsightFetcher = (userId: string, slot: Slot) => Promise<PushInsight | null>;

export const insightKey = (userId: string, slot: Slot) => `${userId}|${slot}`;

/**
 * 알림을 보내기 직전, 사람마다 오늘의 흐름을 읽거나 만든다(이미 만들어 둔 것이 있으면 바로 읽는다).
 * 한 사람에 perUserMs, 모두 합쳐 totalMs를 넘기면 그 사람은 null(= 첫 소식 제목으로 보낸다). 실패도 null.
 * 시간이 넘은 요청은 끊지 못하니 뒤에서 마저 돌아 저장되고, 다시 보내거나 앱을 열 때 그 결과를 쓴다
 */
export async function gatherInsights(
  jobs: readonly { userId: string; slot: Slot }[],
  fetchInsight: InsightFetcher,
  opts: { totalMs: number; perUserMs: number; concurrency: number },
): Promise<Map<string, PushInsight | null>> {
  const out = new Map<string, PushInsight | null>();
  const until = Date.now() + opts.totalMs;
  await mapLimit([...jobs], opts.concurrency, async ({ userId, slot }) => {
    const key = insightKey(userId, slot);
    const left = Math.min(opts.perUserMs, until - Date.now());
    if (left <= 0) {
      out.set(key, null);
      return;
    }
    // 뒤에서 늦게 실패해도 처리되지 않은 거절이 되지 않게 먼저 catch를 건다
    const work = (async () => fetchInsight(userId, slot))().catch(() => null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), left);
    });
    out.set(key, await Promise.race([work, late]));
    clearTimeout(timer);
  });
  return out;
}
