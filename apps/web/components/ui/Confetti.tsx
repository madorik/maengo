/** 축하 영역에 흩뿌린 색종이(위치 %, 기울기, 크기 px, 둥근지). 가입 선물·결제 완료 팝업이 같이 쓴다. 부모는 relative */
const PIECES: { x: number; y: number; r: number; w: number; h: number; c: string; dot?: boolean }[] = [
  { x: 9, y: 22, r: -24, w: 7, h: 14, c: "#34B36A" },
  { x: 18, y: 64, r: 0, w: 9, h: 9, c: "#1A8FE0", dot: true },
  { x: 25, y: 34, r: 28, w: 6, h: 12, c: "#FF6F61" },
  { x: 33, y: 12, r: 0, w: 7, h: 7, c: "#FF9F2E", dot: true },
  { x: 70, y: 14, r: -12, w: 8, h: 8, c: "#FF6F61", dot: true },
  { x: 78, y: 40, r: 38, w: 7, h: 14, c: "#1A8FE0" },
  { x: 88, y: 20, r: 0, w: 6, h: 6, c: "#34B36A", dot: true },
  { x: 90, y: 66, r: -30, w: 6, h: 12, c: "#FF9F2E" },
  { x: 12, y: 86, r: 50, w: 6, h: 11, c: "#FF9F2E" },
  { x: 84, y: 88, r: 0, w: 8, h: 8, c: "#34B36A", dot: true },
];

export function Confetti() {
  return (
    <>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`absolute ${p.dot ? "rounded-full" : "rounded-[2px]"}`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.w, height: p.h, background: p.c, transform: `rotate(${p.r}deg)` }}
        />
      ))}
    </>
  );
}
