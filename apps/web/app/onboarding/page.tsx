import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NEWS_SECTIONS, TOPIC_GROUPS } from "@maengo/core/topics";
import { completeOnboarding } from "../actions";
import { OnboardingSubmit } from "./OnboardingSubmit";
import { TopicPicks } from "./TopicPicks";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { entitlements } from "@/lib/server/profile";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관심사 고르기", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string }> };

/** 주소의 ?error=(completeOnboarding이 되돌려 보낸 까닭)를 글로. 모르는 값이면 없음 */
function errorText(error: string, limit: number): string | undefined {
  const texts: Record<string, string> = {
    empty: "하나 이상 골라 주세요.",
    limit: `관심사는 ${limit}개까지 고를 수 있어요.`,
    etc: "기타에 관심 있는 걸 적어 주세요.",
    adult: "성인 관련 관심사는 넣을 수 없어요.",
  };
  return Object.hasOwn(texts, error) ? texts[error] : undefined;
}

// 처음 로그인한 사람이 관심 분야(5개)와 뉴스 분야(6개)를 고르는 화면(PLAN.md 5.2). 직업은 묻지 않는다.
// 한 화면에 다 보이게 두 칸 격자로 둔다. 둘을 합쳐 플랜 한도(Free 5개)까지 고르고, 다 고르면 나머지 칸은 막는다(TopicPicks).
// 목록에 없는 건 기타를 골라 직접 적는다(Premium만, 설정 > 관심사의 기타와 같다). 상세 관심사(바이브코딩, 비트코인 등)는 설정에서 더한다.
export default async function OnboardingPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (profile.onboarded) redirect("/today");
  const { error } = await searchParams;
  const name = profile.displayName?.split(" ")[0];
  const { topicLimit, customLimit } = entitlements(profile);
  // 기타(목록에 없는 관심사 직접 적기)는 Premium만이라 Free(새로 가입하면 Free)에게는 보이지 않는다
  const customAllowed = customLimit > 0;
  const capped = topicLimit < TOPIC_GROUPS.length + NEWS_SECTIONS.length;
  const message = error ? errorText(error, topicLimit) : undefined;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      <div className="flex items-end gap-3">
        <Mascot mood="cheer" className="size-20 shrink-0" />
        <Bubble className="mb-4 flex-1">
          <p className="text-[16px] font-extrabold leading-snug">
            {name ? `${name}님, ` : ""}어떤 분야 소식을 골라 드릴까요?
          </p>
        </Bubble>
      </div>
      <h1 className="mt-6 text-[24px] font-black leading-snug tracking-[-0.03em]">관심 있는 분야를 골라 주세요</h1>
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">
        {capped ? `관심 분야와 뉴스 헤드라인을 합쳐 ${topicLimit}개까지 고를 수 있어요.` : "여러 개 골라도 돼요."} 더 좁은 관심사(예: 바이브코딩, 비트코인)는 나중에 설정에서 더할 수 있어요.
      </p>

      <form action={completeOnboarding} className="mt-6 flex min-w-0 flex-1 flex-col">
        <TopicPicks
          groups={TOPIC_GROUPS.map((g) => ({ id: g.id, name: g.name }))}
          news={NEWS_SECTIONS.map((n) => ({ id: n.id, name: n.name }))}
          limit={topicLimit}
          customAllowed={customAllowed}
          etcChecked={error === "etc" || error === "adult"}
        />
        {message && (
          <p role="alert" className="mt-4 text-[14px] font-bold text-cherry">
            {message}
          </p>
        )}
        <div className="mt-auto pt-8">
          <OnboardingSubmit />
        </div>
      </form>
    </div>
  );
}
