import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NEWS_SECTIONS, TOPIC_GROUPS } from "@maengo/core/topics";
import { completeOnboarding } from "../actions";
import { IconCheck } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { Bubble } from "@/components/ui/Bubble";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관심사 고르기", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string }> };

const ERRORS: Record<string, string> = {
  empty: "하나 이상 골라 주세요.",
  etc: "기타에 관심 있는 걸 적어 주세요.",
  adult: "성인 관련 관심사는 넣을 수 없어요.",
};

// 처음 로그인한 사람이 관심 분야(5개)와 뉴스 분야(6개)를 고르는 화면(PLAN.md 5.2). 직업은 묻지 않는다.
// 한 화면에 다 보이게 두 칸 격자로 둔다. 목록에 없는 건 기타를 골라 직접 적는다(설정 > 관심사의 기타와 같다).
// 상세 관심사(바이브코딩, 비트코인 등)는 설정에서 더한다.
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
        여러 개 골라도 돼요. 더 좁은 관심사(예: 바이브코딩, 비트코인)는 나중에 설정에서 더할 수 있어요.
      </p>

      <form action={completeOnboarding} className="mt-6 flex min-w-0 flex-1 flex-col">
        {/* fieldset은 기본 최소 폭이 내용 길이라 긴 줄이 화면 밖으로 밀린다. 기타 입력칸은 기타 칸이 체크되면 열린다(group/etc) */}
        <fieldset className="group/etc min-w-0">
          <legend className="text-[15px] font-black">관심 분야</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TOPIC_GROUPS.map((g) => (
              <Choice key={g.id} id={g.id} name={g.name} />
            ))}
            <Choice id="etc" name="기타" inputName="etc" defaultChecked={error === "etc" || error === "adult"} />
          </div>
          <div className="mt-2 hidden group-has-[#pick-etc:checked]/etc:block">
            <label htmlFor="etc-text" className="sr-only">
              관심 있는 것
            </label>
            <input
              id="etc-text"
              name="etcText"
              maxLength={200}
              autoComplete="off"
              aria-describedby="etc-text-hint"
              placeholder="예: 드론, 게임, 부동산"
              className="tile min-h-12 w-full px-4 text-[15px] font-semibold placeholder:text-faint"
            />
            <p id="etc-text-hint" className="mt-1 px-1 text-[13px] font-semibold text-sub">
              쉼표로 나눠 3개까지 적을 수 있어요.
            </p>
          </div>
        </fieldset>
        <fieldset className="mt-6 min-w-0">
          <legend className="text-[15px] font-black">뉴스 헤드라인</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NEWS_SECTIONS.map((n) => (
              <Choice key={n.id} id={n.id} name={n.name} />
            ))}
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

/**
 * 고르는 칸 하나(아이콘 + 이름). 고르면 하늘색 칸이 되고 아이콘 모서리에 체크가 붙는다(label 안의 체크박스 상태를 group-has로 본다).
 * 두 칸 격자라 칸이 좁아서 체크를 오른쪽 끝에 따로 두지 않는다(반도체·로봇이 잘리지 않게).
 */
function Choice({ id, name, inputName = "topic", defaultChecked }: { id: string; name: string; inputName?: string; defaultChecked?: boolean }) {
  return (
    <label className="group block min-w-0 cursor-pointer">
      <input id={`pick-${id}`} type="checkbox" name={inputName} value={inputName === "topic" ? id : "on"} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="tile flex min-h-14 items-center gap-2.5 px-2.5 py-2 transition-colors peer-[:not(:checked)]:hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
        <span className="relative shrink-0">
          <TopicGroupIcon id={id} className="size-9 rounded-xl" iconClassName="size-5" />
          <i aria-hidden className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border-2 border-white bg-sky text-white group-has-[:checked]:flex">
            <IconCheck className="size-3 [stroke-width:3.6]" />
          </i>
        </span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-black">{name}</span>
      </span>
    </label>
  );
}
