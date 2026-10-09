// 맹고 캐릭터. 앱 아이콘(B안)의 얼굴을 몸 전체로 풀어 그렸다.
// happy: 기본 / cheer: 완료 축하(눈웃음, 만세) / listen: 헤드폰을 쓰고 듣는 중
export type MascotMood = "happy" | "cheer" | "listen";

const INK = "#191C32";

export function Mascot({ mood = "happy", className = "size-24", title }: { mood?: MascotMood; className?: string; title?: string }) {
  return (
    <svg
      viewBox="16 8 168 178"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {mood === "cheer" && (
        <g fill="none" stroke="#E5A21F" strokeWidth="9" strokeLinecap="round">
          <path d="M48 118 Q28 100 30 78" />
          <path d="M156 114 Q176 96 172 74" />
        </g>
      )}
      {mood === "listen" && <path d="M38 120 C38 50 162 50 162 120" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />}

      <path d="M100 46 C146 44 168 84 165 122 C162 158 130 180 96 177 C62 174 38 152 39 121 C40 99 52 86 63 73 C75 59 83 47 100 46 Z" fill="#FFC23D" />
      <path d="M164 112 C166 150 136 178 98 177 C128 166 152 146 164 112 Z" fill="#FF9F2E" />
      <ellipse cx="70" cy="88" rx="9" ry="16" transform="rotate(-30 70 88)" fill="#FFE08A" />
      <rect x="96" y="34" width="8" height="15" rx="3" transform="rotate(15 100 42)" fill="#7A4A2A" />
      <path d="M102 44 C112 24 138 16 158 22 C148 42 124 50 102 44 Z" fill="#34B36A" />
      <path d="M107 42 C122 34 138 28 152 24" fill="none" stroke="#23914F" strokeWidth="3" strokeLinecap="round" />

      {mood === "cheer" ? (
        <>
          <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
            <path d="M66 114 Q78 101 90 114" />
            <path d="M110 114 Q122 101 134 114" />
          </g>
          <path d="M85 131 Q100 158 115 131 Z" fill={INK} />
          <path d="M93 145 Q100 152 107 145 Q100 140 93 145 Z" fill="#FF6F61" />
        </>
      ) : (
        <>
          <circle cx="78" cy="112" r="16" fill="#fff" />
          <circle cx="122" cy="112" r="16" fill="#fff" />
          <circle cx="81" cy="115" r="8" fill={INK} />
          <circle cx="119" cy="115" r="8" fill={INK} />
          <circle cx="84" cy="111" r="2.6" fill="#fff" />
          <circle cx="122" cy="111" r="2.6" fill="#fff" />
          <path d="M91 136 Q100 145 109 136" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="64" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45" />
      <ellipse cx="136" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45" />

      {mood === "listen" && (
        <>
          <rect x="24" y="100" width="26" height="42" rx="11" fill={INK} />
          <rect x="150" y="100" width="26" height="42" rx="11" fill={INK} />
          <rect x="31" y="108" width="12" height="26" rx="6" fill="#4FB3F6" />
          <rect x="157" y="108" width="12" height="26" rx="6" fill="#4FB3F6" />
        </>
      )}
    </svg>
  );
}
