import { IconBookmark, IconGear, IconHome } from "@/components/icons";

export const NAV = [
  { href: "/today", label: "오늘", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/settings", label: "설정", Icon: IconGear },
] as const;
