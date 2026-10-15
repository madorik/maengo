import { IconBookmark, IconGear, IconHeadphones, IconHome } from "@/components/icons";

export const NAV = [
  { href: "/today", label: "오늘", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/playlist", label: "플레이리스트", Icon: IconHeadphones },
  { href: "/settings", label: "설정", Icon: IconGear },
] as const;
