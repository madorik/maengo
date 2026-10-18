import { projectMomentum, rubberband } from "./spring";

// 아래에서 올라오는 시트(components/ui/Sheet.tsx)를 손으로 끌어 내려 닫을 때의 계산. 거리는 px(아래가 +), 속도는 px/초

/** 위·아래를 정하기 전에 움직여야 하는 거리(px). 이보다 작게 움직이면 누르기로 둔다 */
export const SHEET_SLOP = 8;
/** 이보다 빠르게 아래로 던지면 거리와 관계없이 닫는다 */
export const FLICK_VELOCITY = 700;
/** 이보다 빠르게 위로 되던지면 많이 끌었어도 남긴다 */
export const REVERSE_VELOCITY = 300;
/** 던진 속도로 더 갈 거리까지 더해 시트 높이의 이 비율을 넘으면 닫는다(긴 시트는 DISMISS_MAX까지만) */
export const DISMISS_FRACTION = 0.4;
export const DISMISS_MAX = 220;
/** 위로 끌면 고무줄처럼 버티며 이 길이 가까이까지만 올라온다 */
const LIFT = 56;

/** 손가락이 움직인 거리(raw)만큼 시트를 옮길 자리. 아래로는 1:1, 위로는 고무줄 */
export function sheetOffset(raw: number): number {
  return raw >= 0 ? raw : rubberband(raw, LIFT);
}

/** 손을 뗐을 때 닫을지(아니면 제자리로 튕겨 돌아간다) */
export function shouldDismiss(offset: number, velocity: number, height: number): boolean {
  if (offset <= 0 || velocity < -REVERSE_VELOCITY) return false;
  if (velocity > FLICK_VELOCITY) return true;
  return offset + projectMomentum(Math.max(velocity, 0)) > Math.min(height * DISMISS_FRACTION, DISMISS_MAX);
}

/** 손을 뗀 순간의 속도(px/초). 최근 100ms 안의 움직임으로 보고, 떼기 전에 멈췄다면 0 */
export function releaseVelocity(samples: readonly { t: number; y: number }[], now: number): number {
  const recent = samples.filter((p) => now - p.t <= 100);
  if (recent.length < 2) return 0;
  const a = recent[0]!;
  const b = recent[recent.length - 1]!;
  return b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
}
