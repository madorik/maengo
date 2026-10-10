import { modelFor } from "@maengo/core/ai";
import { notifyTimeLabel } from "@maengo/core/kst";
import type { Plan } from "@maengo/core/types";
import type { Metadata } from "next";
import { TopicEditor } from "@/components/settings/TopicEditor";
import { demoRebuildFeed, demoReset, demoSetPlan, signOut } from "@/app/actions";
import { ttsModel } from "@/lib/server/ai";
import { toProfileView } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";
import { entitlements } from "@/lib/server/profile";
import { suggestedTopics, userTopics } from "@/lib/server/topics";

export const metadata: Metadata = { title: "설정" };

const PLANS: { id: Plan; label: string; desc: string }[] = [
  { id: "free", label: "무료", desc: "하루 1개를 글로 읽어요. 요약과 문구는 Gemini Flash가 써요." },
  { id: "trial", label: "플러스 체험", desc: "7일 동안 플러스와 같아요. 하루 최대 10개를 받고 들을 수 있어요." },
  { id: "plus", label: "플러스", desc: "하루 최대 10개, 오디오 이어 듣기, 팟캐스트, 스터디 팩. 요약과 문구는 상위 모델이 써요." },
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
  const topics = await userTopics(profile);

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">설정</h1>

      <div className="mt-6">
        <Section id="plan" title="플랜">
          <p className="text-sub">{PLANS.find((p) => p.id === view.plan)!.desc}</p>
          <form action={demoSetPlan} className="mt-4 grid grid-cols-3 gap-2">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="submit"
                name="plan"
                value={p.id}
                aria-pressed={view.plan === p.id}
                className={`tile min-h-12 text-[15px] font-extrabold ${view.plan === p.id ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
              >
                {p.label}
              </button>
            ))}
          </form>
          <p className="mt-2 text-[13px] text-sub">결제가 붙기 전까지 쓰는 데모 전환이에요. 바꾸면 오늘 피드의 문구와 듣기 권한이 바로 바뀌어요.</p>
        </Section>

        <Section id="ai" title="AI 모델">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2">
            <dt className="text-sub">요약과 &ldquo;왜 중요한가&rdquo;</dt>
            <dd className="break-all font-extrabold">{view.model}</dd>
            <dt className="text-sub">오디오 대본(플러스)</dt>
            <dd className="break-all font-extrabold">{modelFor("pro")}</dd>
            <dt className="text-sub">음성 합성(플러스)</dt>
            <dd className="break-all font-extrabold">{ttsModel()}</dd>
          </dl>
          <p className="mt-3 text-[13px] text-sub">
            요약과 &ldquo;왜 중요한가&rdquo;는 매일 새벽 배치가 Gemini로 미리 만들어 둬요. 상위 모델은 Gemini 결제를 켜야 쓸 수 있어서
            지금은 모두 기본 모델 요약을 보여 줘요. 듣기는 아직 실제 목소리 대신 항목마다 차임, 문장마다 짧은 신호음이 나와요.
          </p>
        </Section>

        <Section id="topics" title="관심 토픽">
          <TopicEditor topics={topics} suggestions={suggestedTopics(topics)} limit={entitlements(profile).topicLimit} />
        </Section>

        <Section id="notify" title="알림">
          <p>매일 {notifyTimeLabel(profile.notifyAt)}에 오늘의 맹고를 보내 드려요.</p>
          <p className="mt-1 text-[13px] text-sub">시간 바꾸기와 웹 푸시는 알림 단계에서 열려요.</p>
        </Section>

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
            다시 고르면 지난 피드에 나온 소식, 읽거나 들은 소식, 이미 알아요와 관심 없어요를 누른 소식을 빼고 골라요.
            처음 상태로 되돌리면 읽음·피드백을 지우고 토픽 가중치를 1로 돌려요.
          </p>
        </Section>

        <Section id="account" title="계정">
          <p>데모 계정으로 들어왔어요. Apple·Google 연동은 다음 단계에서 붙여요.</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="btn btn-ghost min-h-11 px-4 text-[14px]">
              로그아웃
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
