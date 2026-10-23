import { Capacitor, registerPlugin } from "@capacitor/core";
import { withBase } from "@/lib/base-path";

// 홈 화면 위젯(앱 1.3부터, apps/mobile의 MaengoWidget 플러그인). 위젯은 쿠키가 없어서 위젯 토큰으로 /api/widget을 부른다.
// 로그인한 화면이 열리면 토큰을 받아 넘기고(syncWidget), 읽음이 바뀌면 다시 그리게 하고(reloadWidget), 로그아웃하면 지운다(clearWidget).
// 예전 빌드에는 플러그인이 없어서 아무것도 하지 않는다.

interface MaengoWidgetPlugin {
  /** 토큰과 부를 주소를 저장하고 위젯을 다시 그린다 */
  setToken(o: { token: string; endpoint: string }): Promise<void>;
  /** 저장한 토큰을 지우고 위젯을 '로그인' 상태로 그린다 */
  clear(): Promise<void>;
  /** 위젯을 다시 그린다(위젯이 /api/widget을 다시 부른다) */
  reload(): Promise<void>;
}

const plugin = registerPlugin<MaengoWidgetPlugin>("MaengoWidget");
const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("MaengoWidget");

/** 같은 앱 실행 안에서는 토큰을 한 번만 받는다(받는 중에 또 불러도 같은 요청을 기다린다). 실패하면 다음에 다시 */
let syncing: Promise<void> | null = null;

export function syncWidget(): Promise<void> {
  if (!available()) return Promise.resolve();
  syncing ??= (async () => {
    try {
      const res = await fetch(withBase("/api/widget/token"), { method: "POST" });
      if (!res.ok) throw new Error(`token ${res.status}`);
      const { token } = (await res.json()) as { token: string };
      await plugin.setToken({ token, endpoint: `${location.origin}${withBase("/api/widget")}` });
    } catch (e) {
      syncing = null;
      console.error("[widget] 토큰을 넘기지 못함", e);
    }
  })();
  return syncing;
}

export async function reloadWidget(): Promise<void> {
  if (!available()) return;
  await plugin.reload().catch(() => {});
}

export async function clearWidget(): Promise<void> {
  if (!available()) return;
  syncing = null;
  await plugin.clear().catch(() => {});
}
