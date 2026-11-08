import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

// 소식 공유(2026-11-08 개편: 공유 시트에서 '링크 복사'와 '다른 앱으로 보내기'를 고른다, components/article/ShareButton.tsx).
// 다른 앱으로: 앱은 네이티브 공유 창(@capacitor/share, 1.2 빌드부터), 웹 브라우저는 navigator.share. 카카오톡·문자 등 설치된 앱이 그 창에 나온다.

export interface ShareContent {
  title: string;
  text: string;
}

/** 'shared' 공유 창을 띄워 보냄, 'cancel' 사용자가 닫음, 'failed' 못 함 */
export type ShareResult = "shared" | "cancel" | "failed";

const isCancel = (e: unknown) => {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /AbortError|cancel/i.test(msg);
};

const nativeShareAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share");

/** 기기 공유 창을 띄울 수 있는지(앱이거나 navigator.share가 있는 브라우저). 없으면 '다른 앱으로 보내기'를 숨긴다 */
export function canShareToApps(): boolean {
  return nativeShareAvailable() || (typeof navigator !== "undefined" && typeof navigator.share === "function");
}

/** 기기 공유 창(설치된 메신저·앱 목록)으로 보낸다 */
export async function shareToApps(c: ShareContent): Promise<ShareResult> {
  try {
    if (nativeShareAvailable()) {
      await Share.share({ title: c.title, text: c.text, dialogTitle: "소식 공유" });
      return "shared";
    }
    if (typeof navigator.share === "function") {
      await navigator.share({ title: c.title, text: c.text });
      return "shared";
    }
  } catch (e) {
    if (isCancel(e)) return "cancel";
  }
  return "failed";
}

/** 글을 클립보드에 복사한다. 클립보드 API가 막힌 웹뷰는 숨긴 입력 칸으로 복사한다 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
