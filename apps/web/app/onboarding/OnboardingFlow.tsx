"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { SECTION_LABEL, SECTIONS, type SectionId } from "@maengo/core/sections";
import { completeOnboarding } from "@/app/actions";
import { answerContextAction } from "@/app/(app)/context-actions";
import { CONTEXT_QUESTIONS } from "@/lib/context";
import type { YoutubeSections } from "@/lib/youtube-sections";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { registerThisBrowser } from "@/lib/web-push";

/**
 * 온보딩 한 페이지(2026-11-12 사용자, 여러 번 고친 끝): 대분류 4개(경제·AI·부동산·IT/과학)를 카드뉴스 표지처럼 2×2 카드로.
 *   카드마다 직접 그린 그림(public/onboarding, 아래 CARDS)과 큰 분야 이름·담긴 주제 한 줄.
 *   ('이미지가 너무 별로', '제목도 더 잘 보이게 컸으면'). 누르면 그 대분류를 통째로 고른다('묶음 풀지 말고 전체 선택', '어차피 대분류는 4개').
 *   고른 대분류의 주제는 모두 내 맞춤 정보에 저장한다(lib/context.ts 온보딩 질문, 세금·정책·AI 같은 주제는 관심사 비중도, lib/server/user-context.ts).
 *   주제를 하나씩 고치는 건 설정 > 맞춤 인사이트. 1개만 골라도 시작한다.
 * 유튜브 구독으로 찾았으면 고르기 없이 찾는 중부터. 건너뛰면 모든 분야를 같게 두고 시작한다
 */
export function OnboardingFlow({ youtube = null }: { youtube?: YoutubeSections | null }) {
  const [step, setStep] = useState<"choose" | "finding">(youtube ? "finding" : "choose");
  /** 고른 대분류(온보딩 질문 key) */
  const [chosen, setChosen] = useState<string[]>([]);
  /** 알림 권한을 받아 이 기기를 등록했는지(서버가 알림을 켠 채로 시작한다, actions.ts finishOnboarding) */
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const weights = youtube ? new Map(Object.entries(youtube.weights) as [SectionId, number][]) : sectionWeights(chosen);
  // 찾는 중을 잠깐 보여 준 뒤 저장한다(completeOnboarding이 오늘 화면으로 보낸다)
  useEffect(() => {
    if (step !== "finding") return;
    const t = window.setTimeout(() => formRef.current?.requestSubmit(), 1600);
    return () => window.clearTimeout(t);
  }, [step]);

  if (step === "finding")
    return (
      <>
        <Finding picked={new Set(weights.keys())} />
        <form ref={formRef} action={completeOnboarding} hidden>
          <input type="hidden" name="mode" value="sections" />
          <input type="hidden" name="push" value={pushOn ? "on" : ""} />
          {[...weights].map(([id, w]) => (
            <input key={id} type="hidden" name="section" value={`${id}:${w.toFixed(2)}`} />
          ))}
        </form>
      </>
    );

  const toggle = (key: string) => setChosen((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const n = chosen.length;
  const start = async () => {
    setBusy(true);
    track("onboarding_complete", { topics: weights.size });
    track("onboarding_interests", { picked: n });
    // 누를 때 알림 권한을 묻고(앱은 기기 창, 웹은 브라우저 창) 허용하면 이 기기를 등록한다
    const r = await registerThisBrowser().catch(() => ({ ok: false as const }));
    track("notify_toggle", { on: r.ok, group: "onboarding" });
    setPushOn(r.ok);
    // 고른 대분류의 주제를 모두 내 맞춤 정보에(실패해도 이어 간다, 설정에서 다시 고른다)
    await Promise.all(
      chosen.map((key) => {
        const q = QUESTION_OF.get(key)!;
        return answerContextAction(key, q.options.map((o) => o.value).join(",")).catch(() => null);
      }),
    );
    setBusy(false);
    setStep("finding");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-3 px-5 pb-1 pt-[max(20px,env(safe-area-inset-top))]">
        <Mascot mood={n >= 1 ? "cheer" : "listen"} className="size-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold leading-snug tracking-[-0.04em]">어떤 소식이 궁금하세요?</h1>
          <p className="text-[14px] font-medium text-sub">고른 주제로 맞춤 인사이트를 제공해 드려요</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 px-4 pb-44 pt-4">
        {ONBOARDING_QUESTIONS.map((q) => {
          const id = q.section as SectionId;
          const on = chosen.includes(q.key);
          const name = q.title ?? SECTION_LABEL[id];
          const card = CARDS[q.key];
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={on}
              aria-label={`${name}: ${card?.topics ?? ""}`}
              onClick={() => toggle(q.key)}
              className={`relative block aspect-[4/5] overflow-hidden rounded-[22px] bg-ink text-left transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                on ? "ring-[3px] ring-mango ring-offset-2 ring-offset-paper" : ""
              }`}
            >
              {card && (
                // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG 그림 4장(public/onboarding)
                <img src={withBase(card.src)} alt="" className="absolute inset-0 size-full object-cover" />
              )}
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <span
                aria-hidden="true"
                className={`absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border-2 transition-colors ${
                  on ? "border-mango bg-mango" : "border-white/85 bg-black/25"
                }`}
              >
                {on && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F2340" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <span className="absolute inset-x-3.5 bottom-3.5">
                <span className="block text-[28px] font-bold leading-none tracking-[-0.04em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">{name}</span>
                {card && <span className="mt-2 block text-[13px] font-semibold leading-snug text-white/85">{card.topics}</span>}
              </span>
            </button>
          );
        })}
        <p className="col-span-2 px-1 pt-1 text-[12.5px] font-medium text-sub">고른 분야의 주제는 설정 &gt; 맞춤 인사이트에서 하나씩 바꿀 수 있어요.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[528px]">
          <p role="status" className="mb-2 text-center text-[13px] font-semibold text-sub">
            {n === 0 ? "1개만 골라도 시작할 수 있어요" : `${n}개 골랐어요`}
          </p>
          <button
            type="button"
            disabled={n < 1 || busy}
            onClick={start}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[16px] font-bold text-paper disabled:bg-snow disabled:text-sub"
          >
            {n >= 1 ? `${n}개로 시작하기` : "관심 있는 분야를 골라 주세요"}
          </button>
          <form action={completeOnboarding} className="flex justify-center">
            <input type="hidden" name="mode" value="sections" />
            <button type="submit" className="min-h-10 px-3 text-[13px] font-semibold text-sub underline underline-offset-4">
              건너뛰고 바로 듣기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * 카드 그림과 담긴 주제 한 줄(2026-11-12 사용자 '차라리 너가 만들어'): 맹고 색(남색·망고)으로 직접 그린 SVG(public/onboarding). 출처 표시가 필요 없다
 */
const CARDS: Record<string, { src: string; topics: string }> = {
  int_economy: { src: "/onboarding/economy.svg", topics: "주식, 환율·금리, 세금" },
  int_ai: { src: "/onboarding/ai.svg", topics: "새 모델, AI 서비스, 관련주" },
  int_real_estate: { src: "/onboarding/real-estate.svg", topics: "내 집 마련, 청약, 집값" },
  int_it_science: { src: "/onboarding/it-science.svg", topics: "반도체, 빅테크, 2차전지" },
};

/** 온보딩 대분류(경제·AI·부동산·IT/과학 차례, lib/context.ts 온보딩 질문) */
const ONBOARDING_QUESTIONS = CONTEXT_QUESTIONS.filter((q) => q.onboarding && q.section);
const QUESTION_OF = new Map(ONBOARDING_QUESTIONS.map((q) => [q.key, q]));

/** 분야 비중: 고른 대분류의 분야 1.2(AI·IT/과학처럼 한 분야에 둘을 고르면 1.4). 고르지 않은 분야는 서버가 0.3으로 둔다 */
function sectionWeights(chosen: string[]): Map<SectionId, number> {
  const out = new Map<SectionId, number>();
  for (const key of chosen) {
    const id = QUESTION_OF.get(key)!.section as SectionId;
    out.set(id, out.has(id) ? 1.4 : 1.2);
  }
  return out;
}

function Finding({ picked }: { picked: Set<string> }) {
  // 분야 9개의 자리(2026-11-11 부동산 추가)
  const spots = [
    "left-[8%] top-[6%]",
    "right-[10%] top-0",
    "left-[2%] top-[42%]",
    "right-[3%] top-[32%]",
    "left-[12%] bottom-[8%]",
    "right-[10%] bottom-[2%]",
    "right-[34%] bottom-[22%]",
    "left-[40%] top-0",
    "left-[30%] bottom-0",
  ];
  return (
    <div className="mx-auto flex h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="relative h-[340px] w-full">
        {SECTIONS.map((s, i) => (
          <span
            key={s.id}
            className={`absolute rounded-full px-3.5 py-1.5 text-[14px] ${spots[i]} ${picked.has(s.id) ? "bg-mango font-bold text-ink" : "bg-snow font-semibold text-faint"}`}
          >
            {s.label}
          </span>
        ))}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Mascot mood="happy" className="bob size-36" />
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="absolute -left-6 -top-2 size-24"
          >
            <circle
              cx="34"
              cy="30"
              r="18"
              fill="#E1F2FF"
              fillOpacity="0.7"
              stroke="#1F2340"
              strokeWidth="5"
            />
            <path
              d="M25 23 Q29 17 37 17"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M21 43 L8 56"
              stroke="#1F2340"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
      <h1
        role="status"
        className="mt-4 text-[23px] font-bold tracking-[-0.04em]"
      >
        관심사를 찾고 있어요
      </h1>
    </div>
  );
}
