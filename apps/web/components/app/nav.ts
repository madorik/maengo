import { IconBookmark, IconHeadphones, IconHome } from "@/components/icons";

// 설정은 주 메뉴에 두지 않고 계정 메뉴(AccountMenu, 프로필을 누르면)에서 연다

export const NAV = [
  { href: "/today", label: "오늘", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/playlist", label: "플레이리스트", Icon: IconHeadphones },
] as const;
