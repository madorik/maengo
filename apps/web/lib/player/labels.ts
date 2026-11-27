/** 음성을 만드는 동안 플레이어 창·듣기 화면에 보이는 말(Premium 안내 음성도 같은 말, lib/voice-samples.ts의 WAIT_LINES) */
export const PREPARING_TEXT = "AI가 요약을 음성으로 변환하고 있어요. 조금만 기다려주세요.";

/**
 * 음성을 기다리는 동안 알려 주는 말과 어림 시간(2026-11-27 사용자: 만드는 10초 동안 지루하지 않게, 기다릴 수 있게 얼마나 걸리는지 알려 주자).
 * Free(Chirp)는 소식 하나를 한 번에 만들어 약 11초, Premium(Gemini)은 약 5초(2026-11-27 잼). 안내 음성(wait-*.mp3)도 같은 말을 한다
 */
export const WAIT = {
  title: "자연스러운 목소리로 만들고 있어요",
  /** 어림 시간이 지나도 안 끝났을 때 */
  lateTitle: "거의 다 됐어요",
  lateNote: "사람이 몰리면 조금 더 걸려요",
} as const;

/** 기다릴 어림 시간(초). 진행 막대가 이 시간 동안 차오른다 */
export function waitSeconds(premium: boolean): number {
  return premium ? 6 : 12;
}

/** '10초쯤 걸려요'처럼 보이고 들리는 시간(어림 시간보다 조금 짧게, 딱 떨어지는 수로) */
export function waitNote(premium: boolean): string {
  return premium ? "5초쯤 걸려요" : "10초쯤 걸려요";
}

/** 좁은 자리(떠 있는 플레이어 막대)용 */
export function waitShort(premium: boolean): string {
  return premium ? "목소리 만드는 중, 5초쯤" : "목소리 만드는 중, 10초쯤";
}

/**
 * 기다린 시간 → 진행 막대 채움(0~1). 어림 시간까지 0.9까지 거의 곧게 차고, 그 뒤로는 0.97을 넘지 않게 천천히(끝을 모르므로 다 채우지 않는다)
 */
export function waitFill(elapsedMs: number, premium: boolean): number {
  const t = elapsedMs / (waitSeconds(premium) * 1000);
  if (t <= 1) return 0.04 + 0.86 * t;
  return Math.min(0.97, 0.9 + 0.07 * (1 - Math.exp(-(t - 1) * 1.5)));
}

export function minutesLabel(ms: number | null): string {
  return ms === null ? "" : `약 ${Math.max(1, Math.round(ms / 60000))}분`;
}
