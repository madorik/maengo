import { PlayerProvider } from "@/components/providers/PlayerProvider";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { TodayProvider } from "@/components/providers/TodayProvider";
import { getTodayData, toProfileView } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";

// 로그인한 화면 전체를 감싼다. 플레이어(<audio>)가 여기 있어서 화면을 옮겨도 재생이 이어진다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
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
