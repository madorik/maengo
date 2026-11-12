// 웹 PlayerProvider 대신(토스판). 오늘의 흐름의 '이 흐름부터 듣기'를 둘러보기 화면의 플레이어로 넘긴다(App.tsx가 연결)
export const tossPlayer: { playId: (clusterId: number) => void } = { playId: () => {} };

export function usePlayer() {
  return { enabled: true, playFrom: (clusterId: number) => tossPlayer.playId(clusterId) };
}
