// 재생 속도. 누를 때마다 이 순서로 돌고, 고른 값은 프로필(profiles.playback_rate)에 남아 다음에 열어도 그 속도로 시작한다.
// 오늘 브리핑 플레이어와 글 하나 듣기가 같은 값을 쓴다. 서버(savePlayerPrefs)도 이 목록에 든 값만 받는다.

export const RATES = [1, 1.2, 1.5, 0.8] as const;

export function isRate(n: unknown): n is number {
  return typeof n === "number" && (RATES as readonly number[]).includes(n);
}

/** 다음 속도. 목록에 없는 값이면 1배로 */
export function nextRate(rate: number): number {
  const i = (RATES as readonly number[]).indexOf(rate);
  return RATES[(i + 1) % RATES.length]!;
}

/** 저장된 값이 이상하면 1배 */
export function initialRate(saved: unknown): number {
  return isRate(saved) ? saved : 1;
}
