import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

// 소식 공유. 앱은 네이티브 공유 시트(@capacitor/share, 1.2 빌드부터), 웹 브라우저는 navigator.share, 둘 다 없으면 글을 복사한다.
// 보내는 글은 ShareButton이 만든다(로그인 없이 보는 소식 주소 /s/[id], 내 관심 링크 글은 원문과 맹고 소개 주소).

export interface ShareContent {
  title: string;
  text: string;
}

/** 'shared' 공유 시트를 띄움, 'copied' 복사함, 'cancel' 사용자가 닫음, 'failed' 못 함 */
export type ShareResult = "shared" | "copied" | "cancel" | "failed";

const isCancel = (e: unknown) => {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /AbortError|cancel/i.test(msg);
};

export async function shareContent(c: ShareContent): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
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
  try {
    await navigator.clipboard.writeText(c.text);
    return "copied";
  } catch {
    return "failed";
  }
}
