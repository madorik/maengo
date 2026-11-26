import { IconArchive, IconGear, IconHash, IconHome, IconTrendUp, IconWon } from "@/components/icons";

/**
 * 아래 메뉴 네 칸(2026-11-26 사용자 '메뉴를 밑으로 내리자', 2026-11-25 6안): 브리핑·보관함·리포트·설정.
 * 모바일은 아래 둥근 막대(BottomNav), 데스크톱은 왼쪽 메뉴(SideNav). 예전 모바일의 ☰ 왼쪽 서랍과 위쪽 프로필 사진(계정 메뉴)은 없앴다.
 * 리포트 칸은 주간 리포트(/report)다. 6안의 이름은 '리서치'였는데 2026-11-26 사용자가 '리포트'로 바꿨다.
 * 설정(/settings)에 계정 정보·로그아웃·내 관심 키워드가 있다.
 * 플레이리스트는 메뉴에 넣지 않는다(2026-11-26 사용자). 보관함 '골라 듣기' → '플레이리스트에 담기'로 들어가고, 그 화면에선 보관함 칸이 켜진다.
 */
export const NAV = [
  // 6안의 '홈'을 2026-11-26 사용자가 '브리핑'으로 바꿨다(출근길·퇴근길 브리핑 화면이라. '오늘'을 거쳐 정함)
  { href: "/today", label: "브리핑", Icon: IconHome },
  // 보관함은 북마크만이 아니라 받은 소식 전부가 모이는 곳이라 보관 상자 아이콘(2026-11-26 사용자)
  { href: "/library", label: "보관함", Icon: IconArchive },
  { href: "/report", label: "리포트", Icon: IconTrendUp },
  // 6안의 '나'(사람 아이콘)를 2026-11-26 사용자가 '설정'으로 바꿨다(톱니바퀴, 화면 제목도 설정)
  { href: "/settings", label: "설정", Icon: IconGear },
] as const;

/** 아래 메뉴 칸이 아닌 화면이 어느 칸에 속하는지(그 칸을 켠다) */
const NAV_PARENT: Record<string, string> = {
  "/playlist": "/library",
  "/keywords": "/settings",
};

/** 좌우로 밀어 옮기는 탭(앱). 설정은 시간 고르기 바퀴·입력 칸이 있어 빼고 브리핑·보관함·리포트만 */
export const SWIPE_TABS = NAV.filter((n) => n.href !== "/settings");

/** 데스크톱 왼쪽 메뉴 아래쪽 링크(모바일은 설정 안에서 들어간다). 요금은 Premium이면 뺀다(NavLinks) */
export const NAV_MORE = [
  { href: "/keywords", label: "내 관심 키워드", Icon: IconHash },
  { href: "/premium", label: "요금", Icon: IconWon },
] as const;

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 지금 주소에서 켤 아래 메뉴 칸 */
export function currentTab(pathname: string): string | undefined {
  const own = NAV.find((n) => under(pathname, n.href));
  if (own) return own.href;
  const parent = Object.keys(NAV_PARENT).find((p) => under(pathname, p));
  return parent ? NAV_PARENT[parent] : undefined;
}

/** 데스크톱 왼쪽 메뉴에서 켤 줄: 아래쪽 링크 화면(내 관심 키워드·요금)이면 그 줄, 아니면 속한 칸 */
export function currentLink(pathname: string): string | undefined {
  return NAV_MORE.find((m) => under(pathname, m.href))?.href ?? currentTab(pathname);
}
