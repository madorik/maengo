import { useSyncExternalStore } from "react";

// 오른쪽 아래에 떠 있는 두 버튼(플레이어 components/listen/ListenWidget.tsx, 글 화면의 맹고 AI components/article/AskDock.tsx)이 서로 맞추는 값.
// - open: 지금 펼친 창. 한쪽을 펴면 다른 쪽은 접는다(웹에서 두 창이 겹치지 않게)
// - player: 플레이어 버튼이 떠 있는지. 글 화면에서는 맹고 AI 버튼이 그 위로 올라간다
// - playerRequest: 밖에서 플레이어 창을 펴 달라고 한 횟수(2026-11-09 오늘 카드의 전체 듣기가 불렀다. 2026-11-11부터 오늘 듣기 막대는 창을 펴지 않아 지금 부르는 곳은 없다). 늘면 플레이어가 재생 목록으로 편다

export type DockPanel = "player" | "ask";
type Dock = { open: DockPanel | null; player: boolean; playerRequest: number };

const SERVER: Dock = { open: null, player: false, playerRequest: 0 };
let state: Dock = SERVER;
const listeners = new Set<() => void>();

function set(next: Partial<Dock>) {
  const merged = { ...state, ...next };
  if (merged.open === state.open && merged.player === state.player && merged.playerRequest === state.playerRequest) return;
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

/** 플레이어 창을 재생 목록으로 펴 달라고 한다(오늘 카드의 '전체 듣기'를 누른 손짓에서) */
export const requestPlayerOpen = () => set({ playerRequest: state.playerRequest + 1 });
