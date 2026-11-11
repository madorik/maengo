import { IconBookmark, IconHash, IconHeadphones, IconHome, IconTrendUp, IconWon } from "@/components/icons";

// 설정은 주 메뉴에 두지 않고 계정 메뉴(AccountMenu, 프로필을 누르면)에서 연다

export const NAV = [
  { href: "/today", label: "오늘 소식", Icon: IconHome },
  { href: "/library", label: "보관함", Icon: IconBookmark },
  { href: "/playlist", label: "플레이리스트", Icon: IconHeadphones },
] as const;

/** 주 메뉴 아래쪽 링크. 좌우로 밀어 넘기는 탭(SwipeTabs, NAV 순서)에는 넣지 않는다(입력 칸·드롭다운이 있는 화면이라).
 *  내 관심 키워드(2026-11-08)는 11-10 개편 때 뺐다가 11-11에 다시 넣었다(사용자: 관심 키워드와 링크 등록은 있어야 한다).
 *  분야 비중은 행동으로 맞추고, 직접 넣고 싶은 키워드·링크는 여기서 넣는다 */
export const NAV_MORE = [
  { href: "/keywords", label: "내 관심 키워드", Icon: IconHash },
  // 주간 리포트(Premium, 2026-11-10). Free에게도 보이고 열면 예시와 Premium 안내
  { href: "/report", label: "주간 리포트", Icon: IconTrendUp },
  { href: "/premium", label: "요금", Icon: IconWon },
] as const;
