import { Capacitor, registerPlugin } from "@capacitor/core";

// 스토어 별점 요청(앱 1.3부터, apps/mobile의 MaengoReview 플러그인). iOS는 SKStoreReviewController, 안드로이드는 Play 인앱 리뷰.
// 실제로 창을 띄울지는 OS가 정한다(iOS는 1년에 3번까지). 그래서 결과는 알 수 없고, 맹고는 좋은 순간에 한 번 부탁만 한다:
// 서로 다른 날 3번 이상 와서 오늘 소식을 다 본 순간, 한 번 부탁하면 120일은 다시 부탁하지 않는다.

interface MaengoReviewPlugin {
  request(): Promise<void>;
}

const plugin = registerPlugin<MaengoReviewPlugin>("MaengoReview");
const DAYS_KEY = "maengo:review-days";
const ASKED_KEY = "maengo:review-asked";
const MIN_DAYS = 3;
const AGAIN_AFTER_MS = 120 * 24 * 3600_000;

function readDays(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DAYS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/** 오늘 다 본 날로 센다(KST 날짜, 최근 10일만 남긴다) */
function countDay(date: string): number {
  const days = readDays();
  if (!days.includes(date)) days.push(date);
  const kept = days.slice(-10);
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify(kept));
  } catch {}
  return kept.length;
}

/** 오늘 소식을 다 봤을 때 부른다. 조건이 맞으면 별점을 부탁한다 */
export async function maybeAskReview(date: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("MaengoReview")) return;
  if (countDay(date) < MIN_DAYS) return;
  try {
    const asked = Number(localStorage.getItem(ASKED_KEY) ?? 0);
    if (asked && Date.now() - asked < AGAIN_AFTER_MS) return;
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    return;
  }
  await plugin.request().catch(() => {});
}
