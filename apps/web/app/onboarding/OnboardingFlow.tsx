"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { SECTIONS, type SectionId } from "@maengo/core/sections";
import { completeOnboarding } from "@/app/actions";
import type { OnboardingPick } from "@/lib/server/onboarding-picks";
import type { YoutubeSections } from "@/lib/youtube-sections";
import { track } from "@/lib/analytics";
import { registerThisBrowser } from "@/lib/web-push";

/**
 * 온보딩(2026-11-10 사용자 '키워드를 고르게 하지 말고 맹고가 찾아 주기'):
 *   1. 분야마다 하나씩 뽑은 소식 중 끌리는 것을 누른다(2개 이상)
 *   2. 찾는 중(잠깐) — 그동안 분야 비중을 저장하고 오늘 화면으로 간다
 * '찾았어요' 결과 화면은 뺐다(2026-11-11 사용자 '이 페이지는 없어도 돼'). 유튜브 구독으로 찾았으면 고르기 없이 찾는 중부터.
 * 건너뛰면 모든 분야를 같게 두고 시작한다. 고른 비중은 듣고 넘기는 행동으로 계속 맞춘다
 */
export function OnboardingFlow({ picks, youtube = null }: { picks: OnboardingPick[]; youtube?: YoutubeSections | null }) {
  // 유튜브 구독으로 찾았으면 고르기 없이 찾는 중부터(그 비중으로 저장)
  const [step, setStep] = useState<"pick" | "finding">(youtube ? "finding" : "pick");
  const [picked, setPicked] = useState<number[]>([]);
  /** 알림 권한을 받아 이 기기를 등록했는지(서버가 알림을 켠 채로 시작한다, actions.ts finishOnboarding) */
  const [pushOn, setPushOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const chosen = picks.filter((p) => picked.includes(p.clusterId));
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

  // 2026-11-11 사용자 '선택 페이지가 너무 별로, 선택하고 싶어지지도 않는다': 사진을 꽉 채운 카드 위에 분야 이름을 크게, 제목은 아래 두 줄로.
  // 분야만 훑어봐도 고를 수 있게. 고른 카드는 망고 테두리·체크, 아래 버튼은 처음부터 남색이고 고른 수를 바로 보인다
  const n = picked.length;
  return (
    <div className="mx-auto flex h-dvh max-w-[560px] flex-col">
      <header className="flex shrink-0 items-center gap-3 px-5 pb-1 pt-[max(24px,env(safe-area-inset-top))]">
        <Mascot mood="listen" className="size-14 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[23px] font-bold leading-snug tracking-[-0.04em]">어떤 소식이 끌리세요?</h1>
          <p className="mt-0.5 text-[14px] font-medium text-sub">2개 이상 고르면 맹고가 관심사를 찾아 드려요</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-40 pt-3">
        <div className="grid grid-cols-2 gap-3">
          {picks.map((p, i) => {
            const on = picked.includes(p.clusterId);
            return (
              <button
                key={p.clusterId}
                type="button"
                aria-pressed={on}
                aria-label={`${p.sectionLabel}: ${p.title}`}
                onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.clusterId) : [...cur, p.clusterId]))}
                className={`relative block aspect-[4/5] overflow-hidden rounded-[22px] text-left transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                  on ? "ring-[3px] ring-mango ring-offset-2 ring-offset-paper" : ""
                } ${i === 0 ? "" : ""} bg-[#1F2340]`}
              >
                {p.photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- 언론사 사진은 원문 주소에서 바로
                  <img src={p.photo} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                )}
                {/* 글자가 읽히게 위·아래를 어둡게 */}
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,17,35,0.62)_0%,rgba(15,17,35,0)_36%,rgba(15,17,35,0)_46%,rgba(15,17,35,0.88)_100%)]" />
                <span className="absolute left-3.5 top-3 text-[20px] font-bold tracking-[-0.03em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{p.sectionLabel}</span>
                <span className="absolute inset-x-3.5 bottom-3 line-clamp-2 text-[13px] font-semibold leading-[1.4] tracking-[-0.02em] text-white/90">{p.title}</span>
                <span
                  aria-hidden="true"
                  className={`absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full border-2 transition-colors ${on ? "border-mango bg-mango" : "border-white/70 bg-black/10"}`}
                >
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F2340" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto max-w-[528px]">
          <button
            type="button"
            disabled={n < 2 || asking}
            onClick={async () => {
              // 누를 때 알림 권한을 묻고(앱은 기기 창, 웹은 브라우저 창) 허용하면 이 기기를 등록한다. 예전 '이대로 시작하기'(OnboardingSubmit)가 하던 일
              track("onboarding_complete", { topics: n });
              setAsking(true);
              const r = await registerThisBrowser().catch(() => ({ ok: false as const }));
              track("notify_toggle", { on: r.ok, group: "onboarding" });
              setPushOn(r.ok);
              setAsking(false);
              setStep("finding");
            }}
            className="flex h-[60px] w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[16px] font-bold text-paper disabled:bg-snow disabled:text-sub disabled:shadow-[0_0_0_1px_var(--color-line)]"
          >
            {n >= 2 ? (
              <>
                <span className="font-round font-black text-mango">{n}</span>개로 내 관심사 찾기
              </>
            ) : (
              `${2 - n}개만 더 골라 주세요`
            )}
          </button>
          <form action={completeOnboarding} className="mt-1 flex justify-center">
            <input type="hidden" name="mode" value="sections" />
            <button type="submit" className="min-h-11 px-3 text-[14px] font-semibold text-sub underline underline-offset-4">
              건너뛰고 바로 듣기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** 고른 소식의 분야 비중: 고른 분야 1, 같은 분야를 또 고르면 0.2씩 더(최대 1.5). 나머지는 서버가 0.3으로 둔다 */
function sectionWeights(chosen: OnboardingPick[]): Map<SectionId, number> {
  const out = new Map<SectionId, number>();
  for (const c of chosen) out.set(c.section, Math.min(1.5, (out.get(c.section) ?? 0.8) + 0.2));
  return out;
}

function Finding({ picked }: { picked: Set<string> }) {
  // 분야 9개의 자리(2026-11-11 부동산 추가)
  const spots = ["left-[8%] top-[6%]", "right-[10%] top-0", "left-[2%] top-[42%]", "right-[3%] top-[32%]", "left-[12%] bottom-[8%]", "right-[10%] bottom-[2%]", "right-[34%] bottom-[22%]", "left-[40%] top-0", "left-[30%] bottom-0"];
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
          <svg viewBox="0 0 64 64" aria-hidden="true" className="absolute -left-6 -top-2 size-24">
            <circle cx="34" cy="30" r="18" fill="#E1F2FF" fillOpacity="0.7" stroke="#1F2340" strokeWidth="5" />
            <path d="M25 23 Q29 17 37 17" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <path d="M21 43 L8 56" stroke="#1F2340" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <h1 role="status" className="mt-4 text-[23px] font-bold tracking-[-0.04em]">
        관심사를 찾고 있어요
      </h1>
    </div>
  );
}
