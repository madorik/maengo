import { BottomNav } from "@/components/app/BottomNav";
import { SideNav } from "@/components/app/SideNav";
import { SwipeTabs } from "@/components/app/SwipeTabs";
import { TopBar } from "@/components/app/TopBar";

// 메뉴가 있는 화면들. 상세(/article)와 듣기(/listen)는 이 밖에서 전체 화면으로 뜬다.
// 메뉴는 데스크톱은 왼쪽에 늘 있고, 모바일은 아래 둥근 막대(BottomNav, 2026-11-26: 브리핑·보관함·리포트·설정)다.
// 플레이어는 (app) 레이아웃에서 아래 메뉴 바로 위 오른쪽에 띄운다(아래 여백은 메뉴 + 그 자리).
// 앱에서는 본문을 좌우로 밀어 브리핑·보관함·리포트를 옮긴다(SwipeTabs).
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto lg:grid lg:max-w-[1240px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <SideNav />
        {/* 세로로 꽉 채워서 내용이 짧은 화면도 빈 곳까지 좌우로 밀 수 있게 한다 */}
        <div className="flex min-h-dvh min-w-0 flex-col">
          <TopBar />
          <SwipeTabs className="flex-1 pb-[calc(max(var(--tabbar-h),env(safe-area-inset-bottom))+96px)] lg:pb-28">{children}</SwipeTabs>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
