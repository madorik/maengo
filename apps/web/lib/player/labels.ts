/** 음성을 만드는 동안 플레이어 창·듣기 화면에 보이는 말. 같은 말을 안내 음성으로도 튼다(lib/voice-samples.ts의 WAIT_LINES) */
export const PREPARING_TEXT = "AI가 요약을 음성으로 변환하고 있어요. 조금만 기다려주세요.";
/** 좁은 자리(플레이어 막대)용 */
export const PREPARING_SHORT = "음성으로 변환하고 있어요";

export function minutesLabel(ms: number | null): string {
  return ms === null ? "" : `약 ${Math.max(1, Math.round(ms / 60000))}분`;
}
