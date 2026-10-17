import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { AnalyticsSession } from "@/components/AnalyticsSession";
import { AppPushSync } from "@/components/app/AppPushSync";
import { ListenWidget } from "@/components/listen/ListenWidget";
import { PlayerProvider } from "@/components/providers/PlayerProvider";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { TodayProvider } from "@/components/providers/TodayProvider";
import { getTodayData, toProfileView } from "@/lib/server/feed";
import { requireOnboarded } from "@/lib/server/session";
import { recordVisit } from "@/lib/server/visits";
import { LISTEN_COLLAPSED_COOKIE } from "@/lib/ui-prefs";

// 로그인해야 보이는 화면은 사람마다 내용이 달라서 검색에 노출하지 않는다.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// 로그인한 화면 전체를 감싼다. 플레이어(<audio>)와 오른쪽 아래 플레이어 위젯이 여기 있어서 어느 화면으로 옮겨도 재생과 플레이어가 이어진다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireOnboarded();
  // DAU·MAU용 접속 기록. 화면을 늦추지 않게 응답을 보낸 뒤에 쓴다
  if (!profile.demo) after(() => recordVisit(profile.id));
  const view = toProfileView(profile);
  const today = await getTodayData(profile);
  const listenCollapsed = (await cookies()).get(LISTEN_COLLAPSED_COOKIE)?.value === "1";
  return (
    <ProfileProvider profile={view}>
      {/* key를 주지 않는다: 피드가 바뀌어도 플레이어를 새로 만들지 않게(TodayProvider가 안에서 합친다) */}
      <TodayProvider initial={today}>
        <PlayerProvider profile={view}>
          {children}
          <ListenWidget initialCollapsed={listenCollapsed} />
        </PlayerProvider>
        <AppPushSync enabled={profile.pushEnabled} />
        {/* 분석용 사용자 ID는 회원 id의 해시만 보낸다(이메일·이름은 보내지 않는다) */}
        <AnalyticsSession uid={createHash("sha256").update(`maengo:${profile.id}`).digest("hex").slice(0, 24)} plan={profile.plan} />
      </TodayProvider>
    </ProfileProvider>
  );
}
