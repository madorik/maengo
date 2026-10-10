import type { Metadata } from "next";
import { PlayerProvider } from "@/components/providers/PlayerProvider";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { TodayProvider } from "@/components/providers/TodayProvider";
import { getTodayData, toProfileView } from "@/lib/server/feed";
import { requireOnboarded } from "@/lib/server/session";

// 로그인해야 보이는 화면은 사람마다 내용이 달라서 검색에 노출하지 않는다.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// 로그인한 화면 전체를 감싼다. 플레이어(<audio>)가 여기 있어서 화면을 옮겨도 재생이 이어진다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireOnboarded();
  const view = toProfileView(profile);
  const today = await getTodayData(profile);
  return (
    <ProfileProvider profile={view}>
      <TodayProvider key={today.signature} initial={today}>
        <PlayerProvider profile={view}>{children}</PlayerProvider>
      </TodayProvider>
    </ProfileProvider>
  );
}
