import type { Metadata } from "next";
import { Crown } from "@/components/icons";
import Link from "next/link";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { ListenPrefs } from "@/components/settings/ListenPrefs";
import { NotifyTimePicker } from "@/components/settings/NotifyTimePicker";
import { ManageSubscription } from "@/components/premium/StoreParts";
import { PushToggle } from "@/components/settings/PushToggle";
import { TopicSettings } from "@/components/settings/TopicSettings";
import { demoRebuildFeed, demoReset } from "@/app/actions";
import { dailyMaengoUsage, toProfileView } from "@/lib/server/feed";
import { syncWallet } from "@/lib/server/wallet";
import { requireProfile } from "@/lib/server/session";
import { demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { entitlements, webPushTokens } from "@/lib/server/profile";
import { newsSections, topicGroups, userTopics } from "@/lib/server/topics";

export const metadata: Metadata = { title: "설정" };



/** 설정 한 묶음. action은 제목 오른쪽에 둔다(알림 켜고 끄기) */
function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t-2 border-line py-7">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id={`${id}-title`} className="text-[20px] font-black tracking-[-0.02em]">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3 text-[15px] font-medium leading-[1.7]">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const profile = await requireProfile();
  const demoTools = demoToolsEnabled();
  const [topics, webTokens, wallet, usage] = await Promise.all([userTopics(profile), webPushTokens(profile.id), syncWallet(profile.id), dailyMaengoUsage(profile)]);
  const view = toProfileView(profile);

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">설정</h1>

      <div className="mt-6">
        <Section id="plan" title="플랜">
          {/* 내 플랜 이름, 오른쪽 끝에 Free면 Premium 알아보기(결제는 /premium), Premium이면 구독 관리(앱에서만) */}
          <div className="flex min-h-12 items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-[22px] font-black tracking-[-0.02em]">
              {view.plan !== "free" && <Crown className="size-6" />}
              {profile.limits.name}
            </p>
            {view.plan === "free" ? (
              <Link href="/premium" className="btn min-h-11 shrink-0 px-4 text-[14px]">
                <Crown className="size-4" />
                Premium 알아보기
              </Link>
            ) : (
              <ManageSubscription uid={profile.id} />
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="tile p-4">
              <p className="text-[13px] font-extrabold text-sub">하루 소식</p>
              {/* 오늘 지급한 소식 / 플랜의 하루 소식 */}
              <p className="font-round text-[26px] font-black leading-tight tabular-nums">
                {usage.given}
                <span className="text-[16px] text-faint">/{usage.daily}</span>
              </p>
            </div>
            <div className="tile p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-extrabold text-sub">지갑</p>
                {/* 맹고 추가 구매를 할 수 있는 플랜만(plans 표) */}
                {view.canBuyMaengo && (
                  <Link href="/premium#maengo" className="text-[13px] font-extrabold text-mango-deep no-underline hover:underline">
                    채우기
                  </Link>
                )}
              </div>
              <p className="font-round text-[26px] font-black leading-tight tabular-nums">{wallet.toLocaleString("ko-KR")}</p>
            </div>
          </div>
        </Section>

        <Section id="topics" title="관심사">
          <TopicSettings
            groups={topicGroups(topics)}
            news={newsSections(topics)}
            custom={topics.filter((t) => t.custom)}
            customAllowed={entitlements(profile).customLimit > 0}
          />
        </Section>

        <Section id="listen" title="듣기 모드">
          <ListenPrefs audio={view.audio} />
        </Section>

        <Section id="notify" title="알림" action={<PushToggle enabled={profile.pushEnabled} webTokens={webTokens} />}>
          <NotifyTimePicker current={profile.notifyAt} />
        </Section>

        <Section id="account" title="계정">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-bold">
            <Link href="/terms" className="text-sub no-underline hover:text-ink hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="text-sub no-underline hover:text-ink hover:underline">
              개인정보 처리방침
            </Link>
          </p>
          <DeleteAccount demo={isDemoAccount(profile.id)} />
        </Section>

        {demoTools && (
          <Section id="demo" title="데모 도구">
            <p className="text-sub">이미 요약된 소식으로 오늘 피드를 다시 골라요. AI를 새로 부르지 않아요.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={demoRebuildFeed}>
                <button type="submit" className="btn btn-ghost min-h-11 px-4 text-[14px]">
                  오늘 피드 다시 고르기
                </button>
              </form>
              <form action={demoReset}>
                <button type="submit" className="btn btn-ghost min-h-11 px-4 text-[14px]">
                  처음 상태로 되돌리기
                </button>
              </form>
            </div>
            <p className="mt-2 text-[13px] text-sub">
              다시 고르면 지난 피드에 나온 소식, 읽거나 들은 소식, 싫어요를 누른 소식을 빼고 골라요.
              처음 상태로 되돌리면 읽음·피드백을 지우고 관심사 가중치를 1로 돌려요.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}
