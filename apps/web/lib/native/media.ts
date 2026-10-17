import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// 잠금 화면·이어폰·알림의 재생 조작. 오늘 브리핑 플레이어(PlayerProvider)와 글 하나 듣기(useItemAudio)가 같은 자리를 나눠 쓴다:
// 마지막으로 재생을 알린 쪽(owner)이 제목을 띄우고 버튼을 받는다.
// 웹·iOS는 웹 표준 Media Session(iOS 웹뷰가 잠금 화면에 띄우고, Info.plist의 audio 백그라운드 모드로 화면을 꺼도 이어진다).
// 안드로이드 앱은 웹뷰가 Media Session을 시스템에 띄우지 않고, 다른 앱으로 가면 앱을 얼려 소리가 멈춘다. 그래서 앱 안 플러그인
// (apps/mobile/android의 MaengoMediaPlugin)이 재생 중에는 포그라운드 서비스를 띄우고 알림·잠금 화면 버튼을 돌려준다. 1.2 전 빌드에는 없다.

/** Media Session 동작 이름과 같다 */
export type MediaAction = "play" | "pause" | "previoustrack" | "nexttrack" | "seekbackward" | "seekforward" | "seekto";
export type MediaActionHandler = (action: MediaAction, seekTime?: number) => void;

export interface MediaState {
  title: string;
  album: string;
  playing: boolean;
  /** 초 */
  position: number;
  /** 초. 모르면 0 */
  duration: number;
  rate: number;
}

interface MaengoMediaPlugin {
  update(state: MediaState & { artist: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(event: "action", cb: (e: { action: MediaAction; seekTime?: number }) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<MaengoMediaPlugin>("MaengoMedia");
const ACTIONS: MediaAction[] = ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"];

let owner: string | null = null;
let handler: MediaActionHandler | null = null;
let wired = false;

/** 플러그인이 든 안드로이드 앱이면 플러그인, 아니면 null(웹·iOS·예전 빌드) */
function native(): MaengoMediaPlugin | null {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("MaengoMedia") ? plugin : null;
}

/** 버튼은 한 번만 걸고, 그때그때 owner의 처리로 넘긴다 */
function wire() {
  if (wired) return;
  wired = true;
  const run: MediaActionHandler = (action, seekTime) => handler?.(action, seekTime);
  void native()?.addListener("action", ({ action, seekTime }) => run(action, seekTime));
  if (!("mediaSession" in navigator)) return;
  for (const action of ACTIONS) {
    try {
      navigator.mediaSession.setActionHandler(action, (d) => run(action, d.seekTime ?? undefined));
    } catch {
      // 지원하지 않는 동작은 건너뛴다
    }
  }
}

/** 재생하거나 멈출 때마다, 제목이 바뀔 때마다 부른다 */
export function showMedia(who: string, state: MediaState, onAction: MediaActionHandler) {
  wire();
  owner = who;
  handler = onAction;
  const media = native();
  if (media) {
    void media.update({ ...state, artist: "맹고" }).catch(() => {});
    return;
  }
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  if (ms.metadata?.title !== state.title || ms.metadata?.album !== state.album) {
    ms.metadata = new MediaMetadata({
      title: state.title,
      artist: "맹고",
      album: state.album,
      artwork: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
    });
  }
  ms.playbackState = state.playing ? "playing" : "paused";
  try {
    if (state.duration > 0) ms.setPositionState({ duration: state.duration, position: Math.min(state.position, state.duration), playbackRate: state.rate });
  } catch {}
}

/** 다 들었거나 화면을 떠날 때. 다른 쪽이 이미 가져갔으면 아무것도 안 한다 */
export function hideMedia(who: string) {
  if (owner !== who) return;
  owner = null;
  handler = null;
  const media = native();
  if (media) {
    void media.stop().catch(() => {});
    return;
  }
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}
