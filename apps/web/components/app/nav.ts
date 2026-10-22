import { IconBookmark, IconHeadphones, IconHome, IconWon } from "@/components/icons";

// 설정은 주 메뉴에 두지 않고 계정 메뉴(AccountMenu, 프로필을 누르면)에서 연다

export const NAV = [
  { href: "/today", label: "오늘 소식", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/playlist", label: "플레이리스트", Icon: IconHeadphones },
] as const;

/** 주 메뉴 아래쪽 링크. 좌우로 밀어 넘기는 탭(SwipeTabs, NAV 순서)에는 넣지 않는다 */
export const NAV_MORE = [{ href: "/premium", label: "요금", Icon: IconWon }] as const;
