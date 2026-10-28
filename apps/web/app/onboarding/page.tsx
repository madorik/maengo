import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ONBOARDING_TOPIC_LIMIT } from "@maengo/core/plans";
import { NEWS_SECTIONS, TOPIC_BY_ID, TOPIC_GROUPS } from "@maengo/core/topics";
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

/**
 * 처음부터 골라 두는 칸(2026-10-23 사용자 결정). 가입하고 아무것도 안 고른 채 떠나는 사람이 많아서(12명 중 5명)
 * 많이 고른 분야(AI·주식)와 뉴스 헤드라인 하나를 골라 둬서 바로 '시작하기'를 눌러도 소식이 오게 한다. 뉴스는 경제 → 생활/문화(2026-10-28 사용자 결정)
 */
const PRESELECTED = ["ai", "stock", "life-culture"] as const;

// 처음 로그인한 사람이 관심 분야(5개)와 뉴스 분야(6개)를 고르는 화면(PLAN.md 5.2). 직업은 묻지 않는다.
// 둘을 합쳐 3개까지 고르고(ONBOARDING_TOPIC_LIMIT, 2026-10-28), 다 고르면 나머지 칸은 막는다(TopicPicks). 더 고르는 건 설정에서 플랜 한도까지.
// 목록에 없는 건 기타를 골라 직접 적는다(Premium만, 설정 > 관심사의 기타와 같다). 상세 관심사(바이브코딩, 비트코인 등)는 설정에서 더한다.
// 휴대폰에서는 화면 높이에 맞춰 위(머리말)·가운데(고르는 칸, 넘치면 여기만 스크롤)·아래(시작하기)로 나눈다. 페이지가 통째로 스크롤되면
// 앱에서 내용이 상태 표시줄·내비게이션 바 밑으로 지나가서, 위는 상태 표시줄만큼 띄우고 시작하기는 늘 아래 시스템 영역 위에 붙여 둔다(2026-10-28).
export default async function OnboardingPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (profile.onboarded) redirect("/today");
  const { error } = await searchParams;
  const name = profile.displayName?.split(" ")[0];
  const { topicLimit, customLimit } = entitlements(profile);
  const limit = Math.min(ONBOARDING_TOPIC_LIMIT, topicLimit);
  // 기타(목록에 없는 관심사 직접 적기)는 Premium만이라 Free(새로 가입하면 Free)에게는 보이지 않는다
  const customAllowed = customLimit > 0;
  const message = error ? errorText(error, limit) : undefined;

  return (
    <form action={completeOnboarding} className="mx-auto flex h-dvh max-w-[560px] flex-col sm:h-auto sm:min-h-dvh">
      <div className="shrink-0 px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-end gap-3">
          <Mascot mood="cheer" className="size-14 shrink-0" />
          <Bubble className="mb-3 flex-1">
            <p className="text-[15px] font-extrabold leading-snug">
              {name ? `${name}님, ` : ""}어떤 분야 소식을 골라 드릴까요?
            </p>
          </Bubble>
        </div>
        <h1 className="mt-4 text-[22px] font-black leading-snug tracking-[-0.03em]">관심 있는 분야를 골라 주세요</h1>
        <p className="mt-1 text-[15px] font-medium leading-relaxed text-sub">관심 분야와 뉴스 헤드라인을 합쳐 {limit}개까지 고를 수 있어요.</p>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-4 pt-5 sm:flex-none sm:overflow-visible">
        <TopicPicks
          groups={TOPIC_GROUPS.map((g) => ({ id: g.id, name: g.name }))}
          news={NEWS_SECTIONS.map((n) => ({ id: n.id, name: n.name }))}
          limit={limit}
          customAllowed={customAllowed}
          etcChecked={error === "etc" || error === "adult"}
          preselected={PRESELECTED.filter((id) => TOPIC_BY_ID.has(id)).slice(0, limit)}
        />
        {message && (
          <p role="alert" className="mt-4 text-[14px] font-bold text-cherry">
            {message}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-line bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:border-t-0 sm:pt-4">
        <OnboardingSubmit />
      </div>
    </form>
  );
}
