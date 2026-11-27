import { mapLimit } from './limit';

// 출근길·퇴근길 알림 문구(2026-11-19 사용자: 뉴스 제목이 아니라 그 사람이 관심 가질 내용으로,
// 2026-11-26 사용자: 딱 봐도 궁금해할 한 줄로, 2026-11-27 사용자: 소식 몇 개·출근길 브리핑 같은 말 쓰지 말고 핵심 이슈만,
// 예를 들어 코스피 5000선 붕괴처럼. 왜 그런지는 앱 안 브리핑이 답한다).
// 제목(잠금 화면 굵은 첫 줄)은 오늘의 핵심 이슈를 사건 그대로, 본문은 같은 사건의 사실 한 줄. 앱 안내 말(브리핑·소식 n개)은 넣지 않는다
// (11-26까지 본문은 늘 '출근길 브리핑 · 소식 10개'였다).
// 오늘의 흐름(웹 쪽 lib/server/briefing-insight.ts, 형식 17)이 같은 호출에서 알림 제목(push)·본문(pushNote)을 만들어 두니 그것을 쓴다.
// DB·AI를 직접 부르지 않는 계산만 둔다(흐름은 콜백으로 받는다). 테스트: __tests__/push-copy.test.ts

/** 알림에 쓸 오늘의 흐름의 일부 */
export interface PushInsight {
  /** 오늘의 흐름 큰 제목(앱 오늘 화면 맨 위와 같은 글) */
  headline: string;
  /** 큰 제목이 닿는 회원 사정의 꼬리표. 비면 오늘 소식 가운데 그 사람 사정에 닿는 게 없다 */
  about: string;
  /** 알림 한 줄(오늘의 핵심 이슈, 사건 그대로 24자 안팎). 형식 16 이전에 만든 흐름이나 거르기에 걸리면 없다 */
  hook?: string;
  /** 알림 본문(같은 사건의 사실 한 줄, 형식 17). 없으면 본문 없이 제목만 */
  note?: string;
  /** 첫 흐름(핵심 이슈)의 핵심 사실 한 줄. 알림 한 줄이 없을 때 제목으로 */
  fact?: string;
}

/** 흐름이 없을 때 쓰는 그 브리핑 첫 소식 */
export interface FirstNews {
  title?: string | null;
  /** 한 줄 요약 */
  short?: string | null;
}

/** 알림 제목 글자 수 상한(잠금 화면 한 줄). 넘으면 줄임표로 자른다 */
export const TITLE_MAX = 32;
/** 알림 본문 글자 수 상한(잠금 화면 두 줄 안쪽) */
export const BODY_MAX = 60;

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const clamp = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * 알림 제목 = 오늘의 핵심 이슈 한 줄. 알림 한 줄(hook)이 먼저, 없으면 첫 흐름의 핵심 사실, 그것도 없으면(형식 11 이전) 큰 제목.
 * 다 없으면 null → 호출한 쪽이 그 브리핑 첫 소식 제목으로 보낸다
 */
export function pushTitle(insight: PushInsight | null | undefined): string | null {
  if (!insight) return null;
  const line = clean(insight.hook) || clean(insight.fact) || clean(insight.headline);
  return line ? clamp(line, TITLE_MAX) : null;
}

/**
 * 알림 제목과 본문. 흐름이 있으면 제목은 pushTitle, 본문은 알림 한 줄과 짝인 사실 한 줄(note)만(없으면 빈 본문 = 제목만).
 * 흐름이 없으면 첫 소식 제목과 그 한 줄 요약. 제목을 못 정하면 null
 */
export function pushCopy(insight: PushInsight | null | undefined, first: FirstNews | null | undefined): { title: string; body: string } | null {
  const fromInsight = pushTitle(insight);
  if (fromInsight) {
    const note = clean(insight!.hook) ? clean(insight!.note) : '';
    return { title: fromInsight, body: note && note !== fromInsight ? clamp(note, BODY_MAX) : '' };
  }
  const title = fallbackTitle(first?.title);
  if (!title) return null;
  const short = clean(first?.short ?? '');
  return { title, body: short && short !== clean(first?.title ?? '') ? clamp(short, BODY_MAX) : '' };
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
