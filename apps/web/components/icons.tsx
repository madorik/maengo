// 디자인 캔버스의 선 아이콘. 24 그리드, 선 굵기 1.8.
type Props = { className?: string };

function Line({ className = "size-5", children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Solid({ className = "size-5", children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="currentColor">
      {children}
    </svg>
  );
}

export const IconPlay = (p: Props) => <Solid {...p}><path d="M8 5.5v13l11-6.5z" /></Solid>;
export const IconPause = ({ className = "size-5" }: Props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M9 6v12" /><path d="M15 6v12" />
  </svg>
);
export const IconPrev = (p: Props) => <Line {...p}><path d="M18 6l-9 6 9 6z" /><path d="M6 6v12" /></Line>;
export const IconNext = (p: Props) => <Line {...p}><path d="M6 6l9 6-9 6z" /><path d="M18 6v12" /></Line>;
export const IconCheck = (p: Props) => <Line {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Line>;
export const IconExternal = (p: Props) => (
  <Line {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Line>
);
export const IconWave = (p: Props) => <Line {...p}><path d="M6 10v6" /><path d="M10 6v12" /><path d="M14 9v8" /><path d="M18 12v4" /></Line>;
export const IconChevronDown = (p: Props) => <Line {...p}><path d="M6 9l6 6 6-6" /></Line>;
export const IconBack = (p: Props) => <Line {...p}><path d="M15 6l-6 6 6 6" /></Line>;
export const IconPodcast = (p: Props) => <Line {...p}><path d="M5 19.5h.01" /><path d="M5 12a7 7 0 0 1 7 7" /><path d="M5 5a14 14 0 0 1 14 14" /></Line>;
export const IconUser = (p: Props) => <Line {...p}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><path d="M4 20a8 8 0 0 1 16 0" /></Line>;
export const IconBell = (p: Props) => <Line {...p}><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Line>;
export const IconHome = (p: Props) => <Line {...p}><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" /></Line>;
export const IconBookmark = (p: Props) => <Line {...p}><path d="M6 4h12v16l-6-4-6 4z" /></Line>;
export const IconGear = (p: Props) => (
  <Line {...p}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.5l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.6h4l.3-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.3z" />
  </Line>
);

// ---- 2차(듀오링고식) 아이콘 ----
export const IconThumbUp = (p: Props) => (
  <Line {...p}><path d="M7 11v9H4v-9z" /><path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.5 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 16.9 20H7" /></Line>
);
export const IconThumbDown = (p: Props) => (
  <Line {...p}><path d="M7 13V4H4v9z" /><path d="M7 13l4 7c1.5 0 2.5-1 2.2-2.6L12.5 14H18a2 2 0 0 0 2-2.3l-1.1-6A2 2 0 0 0 16.9 4H7" /></Line>
);
export const IconPlus = (p: Props) => <Line {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Line>;
export const IconClose = (p: Props) => <Line {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Line>;
export const IconMenu = (p: Props) => <Line {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Line>;
export const IconDoc = (p: Props) => <Line {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7" /><path d="M9 16h5" /></Line>;
export const IconHeadphones = (p: Props) => (
  <Line {...p}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M4 15h3v6H5.5A1.5 1.5 0 0 1 4 19.5z" /><path d="M20 15h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5z" /></Line>
);
export const IconTrophy = (p: Props) => (
  <Line {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4" /><path d="M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4" /><path d="M9 20h6" /></Line>
);
export const IconSpeaker = (p: Props) => (
  <Line {...p}><path d="M4 10v4h4l5 4V6L8 10z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></Line>
);
export const IconMic = (p: Props) => (
  <Line {...p}><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v4" /></Line>
);
export const IconCap = (p: Props) => <Line {...p}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></Line>;
export const IconChat = (p: Props) => <Line {...p}><path d="M4 5h11v8H8l-4 3z" /><path d="M15 9h5v8l-3-2h-6v-2" /></Line>;
export const IconList = (p: Props) => <Line {...p}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></Line>;

// ---- 관심 분야(온보딩 카드). 같은 24 격자·선 굵기 ----
export const IconSparkles = (p: Props) => (
  <Line {...p}><path d="M10 6Q11.2 11.8 17 13Q11.2 14.2 10 20Q8.8 14.2 3 13Q8.8 11.8 10 6Z" /><path d="M18.5 2.7Q19 5 21.3 5.5Q19 6 18.5 8.3Q18 6 15.7 5.5Q18 5 18.5 2.7Z" /></Line>
);
export const IconTrendUp = (p: Props) => <Line {...p}><path d="M4 4v16h16" /><path d="M7.5 15l3.5-4 3 3 5-6" /><path d="M15.5 8h3.5v3.5" /></Line>;
export const IconCoin = (p: Props) => (
  <Line {...p}>
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    <path d="M9.5 8v8" /><path d="M9.5 8h3.4a1.9 1.9 0 0 1 0 3.8H9.5" /><path d="M9.5 11.8h3.9a2.1 2.1 0 0 1 0 4.2H9.5" />
    <path d="M11 6.5V8" /><path d="M13 6.5V8" /><path d="M11 16v1.5" /><path d="M13 16v1.5" />
  </Line>
);
export const IconChip = (p: Props) => (
  <Line {...p}>
    <path d="M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M10 10h4v4h-4z" />
    <path d="M10 3v3" /><path d="M14 3v3" /><path d="M10 18v3" /><path d="M14 18v3" /><path d="M3 10h3" /><path d="M3 14h3" /><path d="M18 10h3" /><path d="M18 14h3" />
  </Line>
);
export const IconCode = (p: Props) => <Line {...p}><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M13.5 4.5l-3 15" /></Line>;
// 뉴스 분야(정치·경제·사회·생활/문화·IT/과학·세계)
export const IconLandmark = (p: Props) => (
  <Line {...p}><path d="M3.5 9.5L12 4.5l8.5 5" /><path d="M5 10v7" /><path d="M9.7 10v7" /><path d="M14.3 10v7" /><path d="M19 10v7" /><path d="M3.5 20h17" /></Line>
);
export const IconWon = (p: Props) => (
  <Line {...p}><circle cx="12" cy="12" r="8.5" /><path d="M7.5 8.5l2 7 2.5-5.5 2.5 5.5 2-7" /><path d="M7 12h10" /></Line>
);
export const IconPeople = (p: Props) => (
  <Line {...p}><path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M16 11.2a2.8 2.8 0 1 0 0-5.6" /><path d="M17.5 14.2a5.5 5.5 0 0 1 3.5 5.3" /></Line>
);
export const IconPalette = (p: Props) => (
  <Line {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6h2.3a3.8 3.8 0 0 0 3.8-3.8c0-3.8-3.8-7.1-8.5-7.1z" />
    <path d="M7.5 12h.01" /><path d="M9.5 8h.01" /><path d="M14 7.5h.01" />
  </Line>
);
export const IconAtom = (p: Props) => (
  <Line {...p}>
    <path d="M12 12.01v-.02" /><ellipse cx="12" cy="12" rx="9" ry="3.6" />
    <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
  </Line>
);
export const IconGlobe = (p: Props) => (
  <Line {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z" /></Line>
);
export const IconPencil = (p: Props) => <Line {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></Line>;

/** Premium 왕관(금색) */
export function Crown({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M3.5 8l4.5 4 4-7 4 7 4.5-4-1.8 10.5H5.3z" fill="#FFC23D" stroke="#E09A12" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.6 20h12.8" stroke="#E09A12" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
