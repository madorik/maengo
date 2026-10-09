import { BottomNav } from "@/components/app/BottomNav";
import { SideNav } from "@/components/app/SideNav";
import { TopBar } from "@/components/app/TopBar";
import { ListenWidget } from "@/components/listen/ListenWidget";

// 메뉴가 있는 화면들. 상세(/article)와 듣기(/listen)는 이 밖에서 전체 화면으로 뜬다.
// "오늘 맹고 전체 듣기"는 오른쪽 아래에 떠 있다.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto lg:grid lg:max-w-[1240px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <SideNav />
        <div className="min-w-0">
          <TopBar />
          <main className="pb-[calc(170px+env(safe-area-inset-bottom))] lg:pb-28">{children}</main>
        </div>
      </div>
      <ListenWidget />
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <BottomNav />
      </div>
    </>
  );
}
