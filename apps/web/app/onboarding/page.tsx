import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { POPULAR_TOPICS, TOPIC_BY_ID } from "@maengo/core/topics";
import { completeOnboarding } from "../actions";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { entitlements } from "@/lib/server/profile";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관심사 고르기", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string }> };

// 처음 로그인한 사람이 관심 토픽을 고르는 화면(PLAN.md 5.2). 직업은 묻지 않는다.
// 알림 시간 고르기는 푸시(FCM)를 붙일 때 둘째 단계로 넣는다.
export default async function OnboardingPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (profile.onboarded) redirect("/today");
  const { error } = await searchParams;
  const limit = entitlements(profile).topicLimit;
  const name = profile.displayName?.split(" ")[0];

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
        고른 분야에서 매일 아침 소식을 골라요. 셋에서 다섯 개쯤이 알맞고, 나중에 설정에서 바꿀 수 있어요.
      </p>

      <form action={completeOnboarding} className="mt-6 flex flex-1 flex-col">
        <fieldset>
          <legend className="sr-only">관심 토픽(최대 {limit}개)</legend>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TOPICS.map((id) => (
              <label key={id} className="cursor-pointer">
                <input type="checkbox" name="topic" value={id} className="peer sr-only" />
                <span className="tile inline-flex min-h-11 items-center px-4 text-[15px] font-extrabold transition-colors hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-checked:text-sky-dark peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
                  {TOPIC_BY_ID.get(id)!.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error === "empty" && (
          <p role="alert" className="mt-4 text-[14px] font-bold text-orange">
            하나 이상 골라 주세요.
          </p>
        )}
        <div className="mt-auto pt-8">
          <button type="submit" className="btn w-full">
            이 분야로 시작하기
          </button>
        </div>
      </form>
    </div>
  );
}
