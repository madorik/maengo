import { useSyncExternalStore } from "react";

// 오른쪽 아래에 떠 있는 두 버튼(플레이어 components/listen/ListenWidget.tsx, 글 화면의 맹고 AI components/article/AskDock.tsx)이 서로 맞추는 값.
// - open: 지금 펼친 창. 한쪽을 펴면 다른 쪽은 접는다(웹에서 두 창이 겹치지 않게)
// - player: 플레이어 버튼이 떠 있는지. 글 화면에서는 맹고 AI 버튼이 그 위로 올라간다

export type DockPanel = "player" | "ask";
type Dock = { open: DockPanel | null; player: boolean };

const SERVER: Dock = { open: null, player: false };
let state: Dock = SERVER;
const listeners = new Set<() => void>();

function set(next: Partial<Dock>) {
  const merged = { ...state, ...next };
  if (merged.open === state.open && merged.player === state.player) return;
  state = merged;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useDock(): Dock {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** 이 창을 편다. 다른 창은 이 값을 보고 접는다. 여는 손짓(클릭)에서 바로 부른다 */
export const claimDock = (who: DockPanel) => set({ open: who });

/** 이 창을 접었다(다른 창이 펴 있으면 그대로 둔다) */
export const releaseDock = (who: DockPanel) => {
  if (state.open === who) set({ open: null });
};

export const setPlayerDocked = (shown: boolean) => set({ player: shown });
