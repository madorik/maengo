import type { Plan } from "@maengo/core/types";
import type { Metadata } from "next";
import { Crown } from "@/components/icons";
import { KeywordEditor } from "@/components/settings/KeywordEditor";
import { ListenPrefs } from "@/components/settings/ListenPrefs";
import { NotifyTimePicker } from "@/components/settings/NotifyTimePicker";
import { TopicEditor } from "@/components/settings/TopicEditor";
import { demoRebuildFeed, demoReset, demoSetPlan } from "@/app/actions";
import { toProfileView } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";
import { demoToolsEnabled } from "@/lib/server/demo";
import { entitlements } from "@/lib/server/profile";
import { topicGroups, userTopics } from "@/lib/server/topics";

export const metadata: Metadata = { title: "설정" };

const PLANS: { id: Plan; label: string; desc: string }[] = [
  { id: "free", label: "Free", desc: "하루 1개를 글로 읽어요." },
  { id: "plus", label: "Premium", desc: "하루 최대 10개, 오디오 이어 듣기, 팟캐스트, 스터디 팩." },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t-2 border-line py-7">
      <h2 id={`${id}-title`} className="text-[20px] font-black tracking-[-0.02em]">
        {title}
      </h2>
      <div className="mt-3 text-[15px] font-medium leading-[1.7]">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const profile = await requireProfile();
  const view = toProfileView(profile);
  const demoTools = demoToolsEnabled();
  const e = entitlements(profile);
  const topics = await userTopics(profile);

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">설정</h1>

      <div className="mt-6">
        <Section id="plan" title="플랜">
          <p className="text-sub">{PLANS.find((p) => p.id === view.plan)!.desc}</p>
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
              <p className="mt-2 text-[13px] text-sub">결제가 붙기 전까지 쓰는 데모 전환이에요(Premium은 기한 없이). 바꾸면 오늘 피드의 문구와 듣기 권한이 바로 바뀌어요.</p>
            </>
          )}
        </Section>

        <Section id="topics" title="관심사">
          <TopicEditor topics={topics.filter((t) => !t.custom)} groups={topicGroups(topics)} limit={e.topicLimit} />
        </Section>

        <Section id="keywords" title="키워드">
          <KeywordEditor keywords={topics.filter((t) => t.custom)} limit={e.keywordLimit} />
        </Section>

        <Section id="listen" title="듣기">
          <ListenPrefs audio={view.audio} />
        </Section>

        <Section id="notify" title="알림">
          <NotifyTimePicker current={profile.notifyAt} />
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
