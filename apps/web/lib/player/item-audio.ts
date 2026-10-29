import { track } from "@/lib/analytics";
import type { Chapter } from "@maengo/core/types";
import { ITEM_PLAY_EVENT, itemAudioUrl, itemInfoUrl } from "./item";
import { ttsErrorMessage } from "./tts-error";

/**
 * 글 하나 듣기(useItemAudio)가 같이 쓰는 오디오 하나. 화면(카드·상세)마다 오디오를 두면 화면을 옮길 때 그 화면이 사라지며
 * 소리가 멈췄다(2026-10-29 오늘 카드에서 듣기를 누르고 상세로 가면 멈춤). 그래서 앱에 하나만 두고, 화면은 지금 듣는 소식의 상태만 본다.
 * 한 번에 한 소식만 소리를 낸다: 다른 소식을 틀면 그 소식으로 바뀌고, 오늘 브리핑 플레이어가 시작하면(ITEM_PLAY_EVENT -1) 멈춘다.
 * 잠금 화면 버튼·재생 속도·목소리 바꾸기는 components/app/ItemAudioHost.tsx가 맡는다
 */

export type ItemStatus = "idle" | "playing" | "paused" | "done";

export interface ItemAudioState {
  /** 지금 이 오디오에 걸린 소식. 없으면 null */
  clusterId: number | null;
  /** 걸린 음성의 주소 조건(소식·말투·목소리, lib/player/item.ts itemQuery) */
  query: string | null;
  status: ItemStatus;
  posMs: number;
  preparing: boolean;
  error: string | null;
  chapter: Chapter | null;
  /** 재생 위치를 옮긴 횟수. 안드로이드 알림의 재생 위치를 맞출 때만 쓴다 */
  seeks: number;
}

export const IDLE_ITEM: ItemAudioState = { clusterId: null, query: null, status: "idle", posMs: 0, preparing: false, error: null, chapter: null, seeks: 0 };

let state: ItemAudioState = IDLE_ITEM;
let audio: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
/** 처음 소리가 나면 '들음'으로 남긴다(틀 때 넘겨받는다, TodayProvider markListened) */
let onListened: ((clusterId: number) => void) | null = null;
let marked = false;

function set(patch: Partial<ItemAudioState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = "none";
  a.addEventListener("timeupdate", () => set({ posMs: a.currentTime * 1000 }));
  a.addEventListener("play", () => set({ status: "playing" }));
  // 취소해 처음 상태로 돌린 뒤 늦게 오는 pause는 무시한다
  a.addEventListener("pause", () => (state.status === "done" || state.status === "idle" ? undefined : set({ status: "paused" })));
  a.addEventListener("seeked", () => set({ seeks: state.seeks + 1 }));
  a.addEventListener("ended", () => {
    set({ status: "done" });
    track("listen_complete", { mode: "item" });
  });
  a.addEventListener("playing", () => {
    set({ preparing: false });
    if (!marked && state.clusterId !== null) {
      marked = true;
      onListened?.(state.clusterId);
    }
  });
  // 파일이 열린 뒤에 대본 시각표를 받는다(그때는 음성이 다 만들어져 있어 실제 시각이 나온다)
  a.addEventListener("loadedmetadata", () => {
    const q = state.query;
    if (!q) return;
    fetch(itemInfoUrl(q), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { chapter: Chapter } | null) => d && state.query === q && set({ chapter: d.chapter }))
      .catch(() => {});
  });
  a.addEventListener("error", () => {
    if (!a.getAttribute("src")) return;
    const id = state.clusterId;
    a.removeAttribute("src");
    set({ preparing: false, status: "idle", query: null });
    void ttsErrorMessage(id ?? undefined).then((error) => state.clusterId === id && set({ error }));
  });
  // 다른 소리(오늘 브리핑 플레이어 -1)가 시작되면 멈춘다
  window.addEventListener(ITEM_PLAY_EVENT, (e) => {
    if ((e as CustomEvent<number>).detail !== state.clusterId) a.pause();
  });
  audio = a;
  return a;
}

/** 걸린 파일을 떼어 내서 다 만들어져도 저절로 시작하지 않게 한다 */
function detach(a: HTMLAudioElement) {
  a.pause();
  if (a.getAttribute("src")) {
    a.removeAttribute("src");
    a.load();
  }
}

export const itemAudio = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: (): ItemAudioState => state,
  /** 잠금 화면 버튼이 쓰는 지금 오디오(없으면 null) */
  element: (): HTMLAudioElement | null => audio,

  /** 이 소식을 튼다. 다른 소식이 걸려 있었으면 이 소식으로 바꾼다. 처음 듣는 목소리면 그 요청에서 서버가 음성을 만든다(수십 초) */
  play(clusterId: number, query: string, rate: number, listened: (clusterId: number) => void) {
    const a = ensureAudio();
    onListened = listened;
    window.dispatchEvent(new CustomEvent(ITEM_PLAY_EVENT, { detail: clusterId }));
    if (state.clusterId !== clusterId || state.query !== query) {
      detach(a);
      marked = false;
      set({ ...IDLE_ITEM, clusterId, query, preparing: true });
      a.src = itemAudioUrl(query);
    } else {
      if (state.status === "done") a.currentTime = 0;
      set({ error: null });
    }
    if (state.status === "idle" || state.status === "done") track("listen_start", { mode: "item" });
    a.defaultPlaybackRate = rate;
    a.playbackRate = rate;
    a.play().catch(() => {});
  },

  pause() {
    audio?.pause();
  },

  /** 음성을 기다리는 중에 그만둔다(이 소식이 걸려 있을 때만) */
  cancel(clusterId: number) {
    if (!audio || state.clusterId !== clusterId) return;
    detach(audio);
    set({ ...IDLE_ITEM, clusterId });
  },

  /** 이 소식 안의 한 시각(ms)으로 옮긴다. 재생·멈춤은 그대로 */
  seek(clusterId: number, ms: number) {
    const a = audio;
    if (!a || state.clusterId !== clusterId || !a.getAttribute("src") || a.readyState < 1) return;
    const end = Number.isFinite(a.duration) ? Math.max(0, a.duration * 1000 - 250) : ms;
    a.currentTime = Math.min(Math.max(0, ms), end) / 1000;
    set({ posMs: a.currentTime * 1000 });
  },

  setRate(rate: number) {
    if (!audio) return;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  },

  /** 듣는 중에 목소리를 바꾸면 새 목소리로 처음부터 다시 튼다 */
  switchQuery(query: string) {
    const a = audio;
    if (!a || state.clusterId === null || !state.query || state.query === query) return;
    const wasPlaying = !a.paused;
    marked = true;
    set({ query, chapter: null, posMs: 0, preparing: true });
    a.src = itemAudioUrl(query);
    if (wasPlaying) a.play().catch(() => {});
  },
};
