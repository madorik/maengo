import type { Announcements } from "@dnd-kit/core";

// 끌어서 순서 바꾸기(dnd-kit)의 화면 읽기 프로그램 안내. 기본은 영어라 한국어로 둔다.
// 플레이리스트 화면(PlaylistView)과 플레이어 재생 목록(listen/controls Queue)이 같이 쓴다.

export const SORT_INSTRUCTIONS = { draggable: "옮기려면 스페이스나 엔터를 누르고 위아래 화살표로 옮긴 뒤 다시 스페이스나 엔터를 누르세요. 그만두려면 Esc." };

/** titleOf: 항목 이름, positionOf: 그 자리의 순번(1부터) */
export function sortAnnouncements(titleOf: (id: unknown) => string, positionOf: (id: unknown) => number): Announcements {
  return {
    onDragStart: ({ active }) => `${titleOf(active.id)}을 집었어요.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)}이 ${positionOf(over.id)}번째 자리에 있어요.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${titleOf(active.id)}을 ${positionOf(over.id)}번째에 놓았어요.` : `${titleOf(active.id)}을 놓았어요.`),
    onDragCancel: ({ active }) => `${titleOf(active.id)} 옮기기를 그만뒀어요.`,
  };
}
