// 앱 아이콘 "소리 막대 망고"(2026-11-25 사용자 결정: 웃는 망고 캐릭터가 너무 가벼워 보인다 → 음성 막대로 그린 망고).
// app/icon.svg·public/mango.svg·apps/mobile/scripts/render-assets.mjs와 같은 그림이다(남색 #1B1F3B, 주황 #FFAA00, 잎 #FFD27A)
// round: 동그란 바탕(플레이어처럼 원 틀 안에 놓일 때. 2026-11-26 사용자: 동그라미 안에 사각형이 들어가 보인다 → 원 모양으로). 막대·잎은 원 안에 다 들어간다
export function MangoIcon({ className = "size-8", title, round = false }: { className?: string; title?: string; round?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {round ? <circle cx="60" cy="60" r="60" fill="#1B1F3B" /> : <rect width="120" height="120" rx="27" fill="#1B1F3B" />}
      <rect x="25" y="58.5" width="10" height="28" rx="5" fill="#FFAA00" />
      <rect x="40" y="44.5" width="10" height="54" rx="5" fill="#FFAA00" />
      <rect x="55" y="37.5" width="10" height="66" rx="5" fill="#FFAA00" />
      <rect x="70" y="42.5" width="10" height="56" rx="5" fill="#FFAA00" />
      <rect x="85" y="56.5" width="10" height="30" rx="5" fill="#FFAA00" />
      <path d="M64 32.5 C67 21.5 78 16.5 90 18.5 C87 29.5 76 34.5 64 32.5 Z" fill="#FFD27A" />
    </svg>
  );
}
