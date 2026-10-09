// 앱 아이콘 B안 "망고 가득". app/icon.svg와 같은 그림이다.
export function MangoIcon({ className = "size-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="200" height="200" rx="45" fill="#FFC23D" />
      <path d="M200 105 L200 155 Q200 200 155 200 L80 200 C140 196 190 160 200 105 Z" fill="#FF9F2E" />
      <ellipse cx="44" cy="58" rx="11" ry="22" transform="rotate(-35 44 58)" fill="#FFE08A" />
      <rect x="110" y="28" width="9" height="17" rx="3" transform="rotate(20 114 36)" fill="#7A4A2A" />
      <path d="M118 40 C130 14 164 6 184 14 C174 38 144 50 118 40 Z" fill="#34B36A" />
      <path d="M123 38 C140 30 160 22 178 16" fill="none" stroke="#23914F" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="70" cy="110" r="22" fill="#FFFFFF" />
      <circle cx="130" cy="110" r="22" fill="#FFFFFF" />
      <circle cx="74" cy="114" r="11" fill="#191C32" />
      <circle cx="126" cy="114" r="11" fill="#191C32" />
      <circle cx="78" cy="108" r="3.5" fill="#FFFFFF" />
      <circle cx="130" cy="108" r="3.5" fill="#FFFFFF" />
      <ellipse cx="50" cy="143" rx="11" ry="7" fill="#FF6F61" opacity="0.45" />
      <ellipse cx="150" cy="143" rx="11" ry="7" fill="#FF6F61" opacity="0.45" />
      <path d="M86 142 Q100 156 114 142" fill="none" stroke="#191C32" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
