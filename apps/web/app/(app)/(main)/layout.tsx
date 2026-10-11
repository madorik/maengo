import { cookies } from "next/headers";
import { SideNav } from "@/components/app/SideNav";
import { SwipeTabs } from "@/components/app/SwipeTabs";
import { TopBar } from "@/components/app/TopBar";
import { ListenWidget } from "@/components/listen/ListenWidget";
import { LISTEN_COLLAPSED_COOKIE } from "@/lib/ui-prefs";

// 메뉴가 있는 화면들. 상세(/article)와 듣기(/listen)는 이 밖에서 전체 화면으로 뜬다.
// 메뉴는 데스크톱은 왼쪽에 늘 있고, 모바일은 위쪽 막대의 ☰로 여는 왼쪽 서랍이다.
// "오늘 맹고 전체 듣기"는 오른쪽 아래에 떠 있고, 작은 망고 버튼으로 접어 둘 수 있다.
// 앱에서는 본문을 좌우로 밀어 오늘·보관함·설정을 옮긴다(SwipeTabs).
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const listenCollapsed = (await cookies()).get(LISTEN_COLLAPSED_COOKIE)?.value === "1";
  return (
    <>
      <div className="mx-auto lg:grid lg:max-w-[1240px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <SideNav />
        {/* 세로로 꽉 채워서 내용이 짧은 화면도 빈 곳까지 좌우로 밀 수 있게 한다 */}
        <div className="flex min-h-dvh min-w-0 flex-col">
          <TopBar />
          <SwipeTabs className="flex-1 pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-28">{children}</SwipeTabs>
        </div>
      </div>
      <ListenWidget initialCollapsed={listenCollapsed} />
    </>
  );
}
