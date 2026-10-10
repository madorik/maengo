import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { childrenOf, TOPIC_GROUPS } from "@maengo/core/topics";
import { completeOnboarding } from "../actions";
import { IconCheck } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관심사 고르기", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string }> };

const ERRORS: Record<string, string> = {
  empty: "하나 이상 골라 주세요.",
  etc: "기타에 관심 있는 걸 적어 주세요.",
  adult: "성인 관련 관심사는 넣을 수 없어요.",
};

// 처음 로그인한 사람이 관심 분야(큰 분류 5개)를 고르는 화면(PLAN.md 5.2). 직업은 묻지 않는다.
// 목록에 없는 건 기타를 골라 직접 적는다(설정 > 관심사의 기타와 같다). 상세 관심사(PostgreSQL, 미국 주식 등)는 설정에서 더한다.
// 알림 시간 고르기는 푸시(FCM)를 붙일 때 둘째 단계로 넣는다.
export default async function OnboardingPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (profile.onboarded) redirect("/today");
  const { error } = await searchParams;
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
        여러 개 골라도 돼요. 목록에 없으면 기타를 골라 직접 적어 주세요. 더 좁은 관심사(예: 바이브코딩, 비트코인)는 나중에 설정에서 더할 수 있어요.
      </p>

      <form action={completeOnboarding} className="mt-6 flex min-w-0 flex-1 flex-col">
        {/* fieldset은 기본 최소 폭이 내용 길이라 긴 설명 줄이 화면 밖으로 밀린다 */}
        <fieldset className="min-w-0">
          <legend className="sr-only">관심 분야(여러 개 고를 수 있어요)</legend>
          <div className="flex flex-col gap-3">
            {TOPIC_GROUPS.map((g) => (
              <label key={g.id} className="group block min-w-0 cursor-pointer">
                <input type="checkbox" name="topic" value={g.id} className="peer sr-only" />
                <span className="tile flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-black">{g.name}</span>
                    <span className="block truncate text-[13px] font-semibold text-sub">
                      {childrenOf(g.id)
                        .map((c) => c.name)
                        .join(", ")}
                    </span>
                  </span>
                  {/* 고르면 하늘색 칸에 체크가 들어간다(label 안의 체크박스 상태를 group-has로 본다) */}
                  <i aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-lg border-2 border-line text-white group-has-[:checked]:border-sky group-has-[:checked]:bg-sky">
                    <IconCheck className="hidden size-4 [stroke-width:3.2] group-has-[:checked]:block" />
                  </i>
                </span>
              </label>
            ))}
            {/* 기타: 고르면 아래 입력칸이 열린다(group/etc 안의 체크박스 상태를 본다) */}
            <div className="group/etc min-w-0">
              <label className="group block min-w-0 cursor-pointer">
                <input type="checkbox" name="etc" className="peer sr-only" defaultChecked={error === "etc" || error === "adult"} />
                <span className="tile flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-black">기타</span>
                    <span className="block truncate text-[13px] font-semibold text-sub">목록에 없는 관심사를 직접 적어요</span>
                  </span>
                  <i aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-lg border-2 border-line text-white group-has-[:checked]:border-sky group-has-[:checked]:bg-sky">
                    <IconCheck className="hidden size-4 [stroke-width:3.2] group-has-[:checked]:block" />
                  </i>
                </span>
              </label>
              <div className="mt-2 hidden group-has-[:checked]/etc:block">
                <label htmlFor="etc-text" className="sr-only">
                  관심 있는 것
                </label>
                <input
                  id="etc-text"
                  name="etcText"
                  maxLength={200}
                  autoComplete="off"
                  aria-describedby="etc-text-hint"
                  placeholder="예: 드론, 반도체, 게임"
                  className="tile min-h-12 w-full px-4 text-[15px] font-semibold placeholder:text-faint"
                />
                <p id="etc-text-hint" className="mt-1 px-1 text-[13px] font-semibold text-sub">
                  쉼표로 나눠 3개까지 적을 수 있어요. 나중에 설정 &gt; 관심사에서 바꿀 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </fieldset>
        {error && ERRORS[error] && (
          <p role="alert" className="mt-4 text-[14px] font-bold text-orange">
            {ERRORS[error]}
          </p>
        )}
        <div className="mt-auto pt-8">
          <button type="submit" className="btn w-full">
            고른 분야로 시작하기
          </button>
        </div>
      </form>
    </div>
  );
}
