import type { Plan } from "@maengo/core/types";
import type { Metadata } from "next";
import { Crown } from "@/components/icons";
import Link from "next/link";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { ListenPrefs } from "@/components/settings/ListenPrefs";
import { NotifyTimePicker } from "@/components/settings/NotifyTimePicker";
import { PushToggle } from "@/components/settings/PushToggle";
import { TopicSettings } from "@/components/settings/TopicSettings";
import { demoRebuildFeed, demoReset, demoSetPlan } from "@/app/actions";
import { toProfileView } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";
import { demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { entitlements, webPushTokens } from "@/lib/server/profile";
import { BETA } from "@/lib/site";
import { newsSections, topicGroups, userTopics } from "@/lib/server/topics";

export const metadata: Metadata = { title: "설정" };

const PLANS: { id: Plan; label: string; desc: string }[] = [
  { id: "free", label: "Free", desc: "하루 1개를 글로 읽어요." },
  { id: "plus", label: "Premium", desc: "하루 최대 10개, 오디오 이어 듣기, 팟캐스트, 스터디 팩." },
];

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
  const view = toProfileView(profile);
  const demoTools = demoToolsEnabled();
  const [topics, webTokens] = await Promise.all([userTopics(profile), webPushTokens(profile.id)]);
  const { dailyItems } = entitlements(profile);

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">설정</h1>

      <div className="mt-6">
        <Section id="plan" title="플랜">
          {BETA ? (
            <p className="text-sub">지금은 베타 기간이라 모든 기능(Premium)을 무료로 써요. 정식 출시 후 모든 사용자는 Free 플랜으로 돌아가요.</p>
          ) : (
            <p className="text-sub">{PLANS.find((p) => p.id === view.plan)!.desc}</p>
          )}
          {view.premiumDaysLeft !== null && (
            <p className="mt-1 text-[14px] font-bold text-sky-dark">가입 기념 Premium이 {view.premiumDaysLeft}일 남았어요. 지나면 Free로 바뀌어요.</p>
          )}
          {demoTools && (
            <>
              <form action={demoSetPlan} className="mt-4 grid grid-cols-2 gap-2">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="submit"
                    name="plan"
                    value={p.id}
                    aria-pressed={view.plan === p.id}
                    className={`tile inline-flex min-h-12 items-center justify-center gap-1 px-1 text-[15px] font-extrabold ${view.plan === p.id ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
                  >
                    {p.id !== "free" && <Crown className="size-4" />}
                    {p.label}
                  </button>
                ))}
              </form>
            </>
          )}
        </Section>

        <Section id="topics" title="관심사">
          {/* 관심사를 많이 골라도 하루 개수(dailyItems)만큼만 오니, 고른 관심사가 매일 다 나오지 않는다는 걸 미리 알린다(사용자 요청) */}
          <p className="mb-3 text-[14px] text-sub">
            관심사는 여러 개 골라도 돼요. 다만 하루에 받는 맹고는 {dailyItems}개라, 고른 관심사 중 그날 중요한 소식부터 {dailyItems}개만 골라 드려요. 그래서 고른 관심사가 매일 모두 나오지는 않아요.
          </p>
          <TopicSettings
            groups={topicGroups(topics)}
            news={newsSections(topics)}
            custom={topics.filter((t) => t.custom)}
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
