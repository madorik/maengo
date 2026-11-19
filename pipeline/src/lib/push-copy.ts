import { mapLimit } from './limit';

// 출근길·퇴근길 알림 본문 고르기(2026-11-19 사용자: 뉴스 제목이 아니라 그 사람이 관심 가질 내용으로).
// 오늘의 흐름(웹 쪽 lib/server/briefing-insight.ts)이 이미 '오늘 소식이 이 사람 사정에 주는 영향'을 만들어 두니 그것을 쓴다.
// DB·AI를 직접 부르지 않는 계산만 둔다(흐름은 콜백으로 받는다). 테스트: __tests__/push-copy.test.ts

/** 알림에 쓸 오늘의 흐름의 일부 */
export interface PushInsight {
  /** 오늘의 흐름 큰 제목(앱 오늘 화면 맨 위와 같은 글) */
  headline: string;
  /** 큰 제목이 닿는 회원 사정의 꼬리표. 비면 오늘 소식 가운데 그 사람 사정에 닿는 게 없다(억지로 맞춤인 척하지 않는다) */
  about: string;
  /** 확인할 것(생활 속 할 일: 보안 공지·신청 기한·바뀌는 제도) 첫 줄 */
  check?: string;
}

/** 본문 글자 수 상한(잠금 화면에서 잘리지 않게. 큰 제목은 30자 안팎, 확인할 것은 50자 안팎) */
export const BODY_MAX = 80;

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const clamp = (s: string) => (s.length > BODY_MAX ? `${s.slice(0, BODY_MAX - 1)}…` : s);

/**
 * 알림 본문. 확인할 것이 있으면 그것이 먼저(바로 해 볼 일), 없으면 큰 제목(사정에 닿을 때만).
 * 둘 다 없으면 null → 호출한 쪽이 첫 소식 제목으로 보낸다
 */
export function insightBody(insight: PushInsight | null | undefined): string | null {
  if (!insight) return null;
  const check = clean(insight.check);
  if (check) return clamp(check);
  const headline = clean(insight.headline);
  if (headline && clean(insight.about)) return clamp(headline);
  return null;
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
