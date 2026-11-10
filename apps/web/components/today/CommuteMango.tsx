/**
 * 노선 위 '지금 위치'의 작은 망고(2026-11-10 사용자): 출근길은 기본 표정(맹고 기본 얼굴: 동그란 눈·작은 웃음),
 * 퇴근길은 신남(눈웃음·벌린 입·선 잎·음표). 둘 다 헤드폰을 쓴다.
 * 출근길은 처음에 시무룩한 얼굴이었는데 "보면 기분이 안 좋아진다"(사용자)고 해서 기본 표정으로 바꿨다
 */
const BODY = "M100 46 C146 44 168 84 165 122 C162 158 130 180 96 177 C62 174 38 152 39 121 C40 99 52 86 63 73 C75 59 83 47 100 46 Z";

export function CommuteMango({ slot, className = "size-10" }: { slot: "am" | "pm"; className?: string }) {
  const band = slot === "pm" ? "#0E1024" : "#191C32";
  return (
    <span className={`relative inline-block ${className}`}>
      <svg viewBox="16 8 168 178" className="size-full" role="img" aria-label={slot === "pm" ? "신난 맹고" : "맹고"}>
        <path d="M38 120 C38 50 162 50 162 120" fill="none" stroke={band} strokeWidth="12" strokeLinecap="round" />
        <path d={BODY} fill="#FFC23D" />
        <path d="M164 112 C166 150 136 178 98 177 C128 166 152 146 164 112 Z" fill="#FF9F2E" />
        {slot === "am" ? (
          <>
            <rect x="96" y="34" width="8" height="15" rx="3" transform="rotate(15 100 42)" fill="#7A4A2A" />
            <path d="M102 44 C112 24 138 16 158 22 C148 42 124 50 102 44 Z" fill="#34B36A" />
            <circle cx="78" cy="112" r="16" fill="#fff" />
            <circle cx="122" cy="112" r="16" fill="#fff" />
            <circle cx="81" cy="115" r="8" fill="#191C32" />
            <circle cx="119" cy="115" r="8" fill="#191C32" />
            <circle cx="84" cy="111" r="2.6" fill="#fff" />
            <circle cx="122" cy="111" r="2.6" fill="#fff" />
            <path d="M91 136 Q100 145 109 136" fill="none" stroke="#191C32" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="64" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45" />
            <ellipse cx="136" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45" />
          </>
        ) : (
          <>
            <rect x="96" y="34" width="8" height="15" rx="3" transform="rotate(15 100 42)" fill="#7A4A2A" />
            <path d="M102 44 C112 24 138 16 158 22 C148 42 124 50 102 44 Z" fill="#34B36A" />
            <g fill="none" stroke="#191C32" strokeWidth="6" strokeLinecap="round">
              <path d="M66 116 Q78 102 90 116" />
              <path d="M110 116 Q122 102 134 116" />
            </g>
            <path d="M84 132 Q100 162 116 132 Z" fill="#191C32" />
            <path d="M92 147 Q100 155 108 147 Q100 141 92 147 Z" fill="#FF6F61" />
            <ellipse cx="62" cy="138" rx="9" ry="6" fill="#FF6F61" opacity="0.6" />
            <ellipse cx="138" cy="138" rx="9" ry="6" fill="#FF6F61" opacity="0.6" />
          </>
        )}
        <rect x="22" y="100" width="28" height="44" rx="12" fill={band} />
        <rect x="150" y="100" width="28" height="44" rx="12" fill={band} />
      </svg>
      {slot === "pm" && (
        <svg viewBox="0 0 30 24" aria-hidden="true" className="absolute -right-5 -top-2 h-[60%] w-[75%]">
          <path d="M8 3.5 L8 14.2 A2.8 2.8 0 1 1 6.3 11.7 L6.3 5.2 L15.5 2.8 L15.5 12.2 A2.8 2.8 0 1 1 13.8 9.7 L13.8 1.4 Z" fill="#FFC23D" transform="rotate(-8 11 10)" />
          <path d="M24 8 L24 17 A2.4 2.4 0 1 1 22.6 14.8 L22.6 8 Z M24 8 Q27.5 9.5 27 12.5 Q26 10.8 24 10.6 Z" fill="#FFC23D" opacity="0.85" transform="rotate(10 24 14)" />
        </svg>
      )}
    </span>
  );
}
