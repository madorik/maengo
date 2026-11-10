import { IconBookmark, IconHeadphones, IconHome, IconTrendUp, IconWon } from "@/components/icons";

// 설정은 주 메뉴에 두지 않고 계정 메뉴(AccountMenu, 프로필을 누르면)에서 연다

export const NAV = [
  { href: "/today", label: "오늘 소식", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/playlist", label: "플레이리스트", Icon: IconHeadphones },
] as const;

/** 주 메뉴 아래쪽 링크. 좌우로 밀어 넘기는 탭(SwipeTabs, NAV 순서)에는 넣지 않는다.
 *  내 관심 키워드(2026-11-08)는 2026-11-10에 뺐다: 키워드를 고르게 하지 않고 맹고가 듣고 읽는 행동으로 관심사를 맞춘다(/keywords 화면은 예전 링크용으로 남김) */
export const NAV_MORE = [
  // 주간 리포트(Premium, 2026-11-10). Free에게도 보이고 열면 예시와 Premium 안내
  { href: "/report", label: "주간 리포트", Icon: IconTrendUp },
  { href: "/premium", label: "요금", Icon: IconWon },
] as const;
