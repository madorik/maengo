"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { SECTIONS, SECTION_LABEL, type SectionId } from "@maengo/core/sections";
import { completeOnboarding } from "@/app/actions";
import type { OnboardingPick } from "@/lib/server/onboarding-picks";
import { OnboardingSubmit } from "./OnboardingSubmit";
import type { YoutubeSections } from "@/lib/youtube-sections";

/**
 * 온보딩(2026-11-10 사용자 '키워드를 고르게 하지 말고 맹고가 찾아 주기'):
 *   1. 분야마다 하나씩 뽑은 오늘 소식 중 끌리는 것을 누른다(2개 이상)
 *   2. 찾는 중(잠깐)
 *   3. 찾았어요: 고른 분야를 앞에(세부 관심사와 함께), 나머지 분야는 이슈도가 높은 소식만. '이대로 시작하기'로 분야 비중을 저장한다
 * 건너뛰면 모든 분야를 같게 두고(분야마다 하루 하나씩 돌아가며) 시작한다. 고른 비중은 듣고 넘기는 행동으로 계속 맞춘다
 */
export function OnboardingFlow({ picks, youtube = null }: { picks: OnboardingPick[]; youtube?: YoutubeSections | null }) {
  // 유튜브 구독으로 찾았으면 결과부터('다시 고르기'를 누르면 소식 고르기로)
  const [step, setStep] = useState<"pick" | "finding" | "result">(youtube ? "result" : "pick");
  const [fromYoutube, setFromYoutube] = useState(!!youtube);
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => {
    if (step !== "finding") return;
    const t = window.setTimeout(() => setStep("result"), 1600);
    return () => window.clearTimeout(t);
  }, [step]);
  const chosen = picks.filter((p) => picked.includes(p.clusterId));
  const weights = sectionWeights(chosen);

  if (step === "finding") return <Finding picked={new Set(chosen.map((c) => c.section))} />;
  if (step === "result" && fromYoutube && youtube) {
    const yw = new Map(Object.entries(youtube.weights) as [SectionId, number][]);
    const details = new Map(Object.entries(youtube.channels) as [SectionId, string[]][]);
    return (
      <Result
        weights={yw}
        detailsOf={(id) => details.get(id) ?? []}
        lead="유튜브 구독 채널에서 찾았어요"
        onBack={() => {
          setFromYoutube(false);
          setStep("pick");
        }}
      />
    );
  }
  if (step === "result")
    return (
      <Result
        weights={weights}
        detailsOf={(id) => [...new Set(chosen.filter((c) => c.section === id && c.detail).map((c) => c.detail!))]}
        lead="이 순서로 먼저 들려 드릴게요"
        onBack={() => setStep("pick")}
      />
    );

  return (
    <div className="mx-auto flex h-dvh max-w-[560px] flex-col">
      <h1 className="shrink-0 px-5 pt-[max(28px,env(safe-area-inset-top))] text-[23px] font-bold leading-snug tracking-[-0.04em]">끌리는 소식을 눌러 주세요</h1>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {picks.map((p) => {
            const on = picked.includes(p.clusterId);
            return (
              <button
                key={p.clusterId}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.clusterId) : [...cur, p.clusterId]))}
                className={`block rounded-[20px] border-2 p-1.5 text-left ${on ? "border-mango bg-mango-tint/50" : "border-transparent bg-snow"}`}
              >
                <span className="relative block h-24 overflow-hidden rounded-[14px] bg-line">
                  <span className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold text-sub">{p.sectionLabel}</span>
                  {p.photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- 언론사 사진은 원문 주소에서 바로
                    <img src={p.photo} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                  )}
                  {on && (
                    <span aria-hidden="true" className="absolute right-2 top-2 flex size-[26px] items-center justify-center rounded-full bg-mango shadow-[0_2px_6px_rgba(31,35,64,0.25)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F2340" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="mx-1 mt-2 block text-[12px] font-semibold text-sub">{p.sectionLabel}</span>
                <span className="mx-1 mb-1 mt-0.5 line-clamp-3 block text-[14px] font-semibold leading-[1.42] tracking-[-0.02em]">{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto max-w-[528px]">
          {picked.length >= 2 ? (
            <button type="button" onClick={() => setStep("finding")} className="flex h-[60px] w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[16px] font-bold text-paper">
              <span className="font-round font-black text-mango">{picked.length}</span>개로 내 관심사 찾기
            </button>
          ) : (
            <p className="flex h-[60px] items-center justify-center rounded-full bg-snow text-[15px] font-semibold text-sub">2개 이상 골라 주세요</p>
          )}
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
  const spots = ["left-[8%] top-[6%]", "right-[10%] top-0", "left-[2%] top-[42%]", "right-[3%] top-[32%]", "left-[12%] bottom-[8%]", "right-[10%] bottom-[2%]", "right-[34%] bottom-[22%]", "left-[40%] top-0"];
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

function Result({ weights, detailsOf, lead, onBack }: { weights: Map<SectionId, number>; detailsOf: (id: SectionId) => string[]; lead: string; onBack: () => void }) {
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const rest = SECTIONS.filter((s) => !weights.has(s.id));
  const max = Math.max(...ranked.map(([, w]) => w), 1);
  return (
    <form action={completeOnboarding} className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(40px,env(safe-area-inset-top))]">
      <input type="hidden" name="mode" value="sections" />
      {ranked.map(([id, w]) => (
        <input key={id} type="hidden" name="section" value={`${id}:${w.toFixed(2)}`} />
      ))}
      <div className="flex items-center gap-3.5 px-2">
        <Mascot mood="cheer" className="pop size-16 shrink-0" />
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.04em]">찾았어요!</h1>
          <p className="mt-0.5 text-[14px] font-medium text-sub">{lead}</p>
        </div>
      </div>
      <ol aria-label="찾은 관심사" className="mt-6 rounded-3xl bg-snow px-4 py-1.5">
        {ranked.map(([id, w], i) => {
          const details = detailsOf(id);
          const level = Math.max(1, Math.round((w / max) * 4));
          return (
            <li key={id} className="flex items-center gap-3 border-b border-line py-3.5">
              <span className="w-[18px] font-round text-[15px] font-black text-mango-dark">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{SECTION_LABEL[id]}</p>
                {details.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {details.map((d) => (
                      <span key={d} className="rounded-full bg-paper px-2.5 py-0.5 text-[12px] font-semibold text-sub">
                        {d}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <span role="img" aria-label={`관심 정도 4단계 중 ${level}`} className="flex h-[18px] items-end gap-[3px]">
                {[8, 11, 14, 18].map((h, k) => (
                  <span key={h} className={`w-1.5 rounded-sm ${k < level ? "bg-mango" : "bg-line"}`} style={{ height: h }} />
                ))}
              </span>
            </li>
          );
        })}
        {rest.length > 0 && (
          <li className="py-3.5">
            <p className="text-[13px] font-semibold text-sub">이슈도가 높은 소식만</p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {rest.map((s) => (
                <span key={s.id} className="rounded-full bg-paper px-3 py-1 text-[13px] font-semibold text-sub">
                  {s.label}
                </span>
              ))}
            </p>
          </li>
        )}
      </ol>
      <div className="mt-auto flex flex-col gap-1 pt-6">
        <OnboardingSubmit label="이대로 시작하기" />
        <button type="button" onClick={onBack} className="min-h-11 text-[14px] font-semibold text-sub">
          다시 고르기
        </button>
      </div>
    </form>
  );
}
