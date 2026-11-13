import { Mascot, type MascotMood } from "@/components/Mascot";

/**
 * 서류 더미를 바쁘게 뒤지는 맹고(2026-11-13 사용자: 맹고가 너무 가만히 있다, 바쁘게 문서 뒤지는 것처럼).
 * 뒤 더미에서 종이 세 장이 차례로 휙휙 날아가고, 맹고는 분발하는 얼굴(effort: 악문 이·땀방울)로 갸웃갸웃, 앞에는 종이 더미. 스크립트 없이 CSS만(globals.css busy-*):
 * 오늘의 흐름 만드는 중 카드는 서버가 먼저 그린 대체 화면이라 브라우저에서 살아나지 않는다.
 * 기본 크기는 4rem(64px). 더 크게는 scale로 키운다(온보딩 관심사 찾기 화면)
 */
export function BusyMango({ mood = "effort", scale = 1 }: { mood?: MascotMood; scale?: number }) {
  return (
    <span className="busy-mango" aria-hidden="true" style={scale === 1 ? undefined : { width: `${4 * scale}rem`, height: `${4 * scale}rem` }}>
      <span className="busy-mango-inner" style={scale === 1 ? undefined : { transform: `scale(${scale})` }}>
        <span className="busy-paper busy-paper-1" />
        <span className="busy-paper busy-paper-2" />
        <span className="busy-paper busy-paper-3" />
        <Mascot mood={mood} className="busy-mango-body size-14" />
        <span className="busy-pile" />
      </span>
    </span>
  );
}
