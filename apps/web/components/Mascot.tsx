// 맹고 캐릭터. 앱 아이콘(B안)의 얼굴을 몸 전체로 풀어 그렸다.
// happy: 기본 / cheer: 완료 축하(눈웃음, 만세) / listen: 헤드폰을 쓰고 듣는 중
// shiver: 헤드폰 + 추워서 떠는 중(목도리, 떨림) / squeeze: 헤드폰 + 붐비는 데 끼여 찡그린 얼굴 — 소개 페이지 '이런 순간' 카드
export type MascotMood = "happy" | "cheer" | "listen" | "shiver" | "squeeze";

const INK = "#191C32";
const BODY = "M100 46 C146 44 168 84 165 122 C162 158 130 180 96 177 C62 174 38 152 39 121 C40 99 52 86 63 73 C75 59 83 47 100 46 Z";

export function Mascot({ mood = "happy", className = "size-24", title }: { mood?: MascotMood; className?: string; title?: string }) {
  const headphones = mood === "listen" || mood === "shiver" || mood === "squeeze";
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
      {/* 떨림: 양옆으로 흔들린 몸의 잔상 */}
      {mood === "shiver" && (
        <g opacity="0.35" fill="none" stroke="#FFB21F" strokeWidth="4">
          <path d={BODY} transform="translate(-7 0)" />
          <path d={BODY} transform="translate(7 0)" />
        </g>
      )}
      {headphones && <path d="M38 120 C38 50 162 50 162 120" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />}

      <path d={BODY} fill="#FFC23D" />
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
      ) : mood === "squeeze" ? (
        <>
          {/* 찌푸린 눈썹, 질끈 감은 눈(><), 일그러진 입, 식은땀 */}
          <g fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M62 87 L90 98" />
            <path d="M110 98 L138 87" />
            <path d="M70 104 L86 113 L70 122" />
            <path d="M130 104 L114 113 L130 122" />
            <path d="M86 143 Q93 135 100 143 Q107 151 114 143" strokeWidth="4.5" />
          </g>
          <path d="M150 76 C155 84 158 89 158 93 A8 8 0 0 1 142 93 C142 89 145 84 150 76 Z" fill="#8FD0F7" />
        </>
      ) : (
        <>
          <circle cx="78" cy="112" r="16" fill="#fff" />
          <circle cx="122" cy="112" r="16" fill="#fff" />
          <circle cx="81" cy="115" r="8" fill={INK} />
          <circle cx="119" cy="115" r="8" fill={INK} />
          <circle cx="84" cy="111" r="2.6" fill="#fff" />
          <circle cx="122" cy="111" r="2.6" fill="#fff" />
          {mood === "shiver" ? (
            <>
              {/* 걱정스럽게 처진 눈썹과 딱딱 부딪치는 이 */}
              <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
                <path d="M62 93 L88 84" />
                <path d="M112 84 L138 93" />
              </g>
              <rect x="86" y="131" width="28" height="14" rx="4" fill="#fff" stroke={INK} strokeWidth="3.5" />
              <g stroke={INK} strokeWidth="2.5">
                <path d="M93 131v14" />
                <path d="M100 131v14" />
                <path d="M107 131v14" />
                <path d="M86 138h28" />
              </g>
            </>
          ) : (
            <path d="M91 136 Q100 145 109 136" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          )}
        </>
      )}
      <ellipse cx="64" cy="137" rx="8" ry="5" fill="#FF6F61" opacity={mood === "shiver" ? 0.75 : 0.45} />
      <ellipse cx="136" cy="137" rx="8" ry="5" fill="#FF6F61" opacity={mood === "shiver" ? 0.75 : 0.45} />

      {/* 추위: 목도리와 몸 양옆 떨림 선(보이는 틀 안에 들어가게 짧게) */}
      {mood === "shiver" && (
        <>
          <path d="M46 150 Q100 172 160 146 L163 161 Q100 188 48 166 Z" fill="#FF6F61" />
          <path d="M122 166 L140 165 L143 185 L126 186 Z" fill="#E8574A" />
          <g fill="none" stroke="#5E6380" strokeWidth="4" strokeLinecap="round">
            <path d="M31 152 l-11 -4" />
            <path d="M29 165 l-12 0" />
            <path d="M31 178 l-11 4" />
            <path d="M169 156 l11 -4" />
            <path d="M171 169 l12 0" />
            <path d="M169 182 l11 4" />
          </g>
        </>
      )}

      {headphones && (
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
