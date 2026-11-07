import type { CategoryId } from '@maengo/core/categories';

// 로그인 없이 둘러보기(lib/server/guest-tour.ts)에서 들려줄 소식을 고르고 늘어놓는 순수 함수(테스트: lib/__tests__/guest-tour-pick.test.ts).

export interface PickCandidate {
  category: CategoryId;
  /** Premium 목소리(Gemini)로 만든 음성인지 */
  premium: boolean;
  /** 이슈도·새로움 점수(클수록 먼저) */
  score: number;
}

const better = (a: PickCandidate, b: PickCandidate) => Number(b.premium) - Number(a.premium) || b.score - a.score;

/**
 * Premium 목소리 소식이 먼저, 그 안에서는 점수 순으로 max개를 고른다.
 * 한 분야는 먼저 perCategory개까지만 넣고, 모자라면 남은 것을 순서대로 채운다(AI 소식만 열 개가 되지 않게).
 * 듣는 순서는 같은 분야가 잇따르지 않게 섞는다: 같은 목소리 묶음 안에서 바로 앞 소식과 분야가 다른 것 중 가장 앞의 것을 먼저
 */
export function pickGuestItems<T extends PickCandidate>(candidates: readonly T[], max: number, perCategory: number): T[] {
  const ranked = [...candidates].sort(better);
  const picked: T[] = [];
  const perCat = new Map<CategoryId, number>();
  for (const c of ranked) {
    if (picked.length >= max) break;
    const n = perCat.get(c.category) ?? 0;
    if (n >= perCategory) continue;
    perCat.set(c.category, n + 1);
    picked.push(c);
  }
  for (const c of ranked) {
    if (picked.length >= max) break;
    if (!picked.includes(c)) picked.push(c);
  }

  const rest = picked.sort(better);
  const out: T[] = [];
  while (rest.length) {
    const prev = out.at(-1)?.category;
    const group = rest[0]!.premium;
    const i = rest.findIndex((c) => c.premium === group && c.category !== prev);
    out.push(rest.splice(Math.max(0, i), 1)[0]!);
  }
  return out;
}
