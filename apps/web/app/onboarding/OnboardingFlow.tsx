"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BusyMango } from "@/components/BusyMango";
import { Mascot } from "@/components/Mascot";
import { SECTION_LABEL, SECTIONS, type SectionId } from "@maengo/core/sections";
import { completeOnboarding } from "@/app/actions";
import { answerContextAction } from "@/app/(app)/context-actions";
import { CONTEXT_QUESTIONS, QUESTION_BY_KEY } from "@/lib/context";
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
 * 2026-11-13: 카드 다음 한 화면(FocusStep)에서 '요즘 신경 쓰는 경제 부문'(여러 개, 개수 제한 없음)과 '하는 일'을 받는다(건너뛸 수 있다).
 *   카드는 분야를 통째로 골라 무엇을 먼저 짚을지 알 수 없었고, 맞춤 정보가 있는 실사용자가 19명 중 2명뿐이었다(맹고-문서/오늘의-흐름.md)
 *   두 화면은 주소의 ?step=focus로 가른다(window.history.pushState, Next 라우터와 이어진다). 그래서 '이전' 버튼과
 *   휴대폰 뒤로 가기(안드로이드 버튼·iOS 밀기)로 카드 화면에 돌아오고, 고른 카드는 그대로 남는다(2026-11-13 사용자: 이전 단계로 가는 게 없다)
 *   화면 글에 '돈'은 쓰지 않는다('관심 있는 경제 부문'처럼 돌려 말한다, 2026-11-13 사용자)
 */
export function OnboardingFlow({ youtube = null, name = null }: { youtube?: YoutubeSections | null; name?: string | null }) {
  const [step, setStep] = useState<"choose" | "finding">(youtube ? "finding" : "choose");
  /** 고른 대분류(온보딩 질문 key) */
  const [chosen, setChosen] = useState<string[]>([]);
  // 카드 다음 화면인지(?step=focus). 카드를 고르지 않은 채 그 주소로 들어오면(새로 고침) 카드 화면부터
  const params = useSearchParams();
  const atFocus = params.get("step") === "focus" && chosen.length > 0;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("step") === "focus") window.history.replaceState(null, "", window.location.pathname);
  }, []);
  /** 요즘 신경 쓰는 경제 부문(개수 제한 없음)과 하는 일 */
  const [focus, setFocus] = useState<string[]>([]);
  const [job, setJob] = useState<string | null>(null);
  /** 알림 권한을 받아 이 기기를 등록했는지(서버가 알림을 켠 채로 시작한다, actions.ts finishOnboarding) */
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const weights = youtube ? new Map(Object.entries(youtube.weights) as [SectionId, number][]) : sectionWeights(chosen);
  // 찾는 중을 잠깐(2.4초, 2026-11-13 맹고가 관심사 더미를 뒤지는 움직임을 볼 만큼) 보여 준 뒤 저장한다(completeOnboarding이 오늘 화면으로 보낸다)
  useEffect(() => {
    if (step !== "finding") return;
    const t = window.setTimeout(() => formRef.current?.requestSubmit(), 2400);
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
  const next = () => {
    track("onboarding_interests", { picked: n });
    window.history.pushState(null, "", "?step=focus");
    window.scrollTo(0, 0);
  };
  const start = async () => {
    setBusy(true);
    track("onboarding_complete", { topics: weights.size });
    track("onboarding_focus", { focus: focus.join(","), job: job ?? "", picked: focus.length + (job ? 1 : 0) });
    // 누를 때 알림 권한을 묻고(앱은 기기 창, 웹은 브라우저 창) 허용하면 이 기기를 등록한다
    const r = await registerThisBrowser().catch(() => ({ ok: false as const }));
    track("notify_toggle", { on: r.ok, group: "onboarding" });
    setPushOn(r.ok);
    // 고른 대분류의 주제를 모두 내 맞춤 정보에, 신경 쓰는 것·하는 일도(실패해도 이어 간다, 설정에서 다시 고른다)
    await Promise.all([
      ...chosen.map((key) => {
        const q = QUESTION_OF.get(key)!;
        return answerContextAction(key, q.options.map((o) => o.value).join(",")).catch(() => null);
      }),
      focus.length ? answerContextAction("focus", FOCUS.options.map((o) => o.value).filter((v) => focus.includes(v)).join(",")).catch(() => null) : null,
      job ? answerContextAction("job", job).catch(() => null) : null,
    ]);
    setBusy(false);
    setStep("finding");
  };

  if (atFocus)
    return (
      <FocusStep
        name={name}
        focus={focus}
        job={job}
        busy={busy}
        onFocus={(v) => setFocus((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
        onJob={(v) => setJob((cur) => (cur === v ? null : v))}
        onBack={() => window.history.back()}
        onStart={start}
      />
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <StepBar step={1} />
      <header className="flex items-center gap-3 px-5 pb-1 pt-2">
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
            onClick={next}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[16px] font-bold text-paper disabled:bg-snow disabled:text-sub"
          >
            {n >= 1 ? `${n}개 고르고 다음` : "관심 있는 분야를 골라 주세요"}
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
  int_ai: { src: "/onboarding/ai.svg", topics: "새 모델, 로봇, 관련주" },
  int_real_estate: { src: "/onboarding/real-estate.svg", topics: "내 집 마련, 청약, 집값" },
  int_it_science: { src: "/onboarding/it-science.svg", topics: "반도체, 빅테크, 2차전지" },
};

/** 요즘 신경 쓰는 경제 부문(개수 제한 없음)과 하는 일(lib/context.ts) */
const FOCUS = QUESTION_BY_KEY.get("focus")!;
const JOB = QUESTION_BY_KEY.get("job")!;

/** 24px 선 아이콘(남색 선, 고르면 망고 바탕 위에) */
function Ico({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** 경제 부문 칸: 아이콘과 그 부문에서 짚을 소식 한 줄(무엇을 받게 되는지) */
const FOCUS_LOOK: Record<string, { sub: string; icon: ReactNode }> = {
  kr_stock: { sub: "코스피·실적", icon: <Ico><path d="M4 18l5-5.5 3.5 3L20 7.5" /><path d="M15 7.5h5v5" /></Ico> },
  us_stock: { sub: "나스닥·빅테크", icon: <Ico><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" /></Ico> },
  crypto: { sub: "비트코인·거래소", icon: <Ico><circle cx="12" cy="12" r="8.5" /><path d="M10 8h3.2a2 2 0 010 4H10V8zm0 4h3.7a2 2 0 010 4H10v-4zM11.5 6.5V8M11.5 16v1.5" /></Ico> },
  fx: { sub: "달러·엔화", icon: <Ico><path d="M5 9h13l-3.5-3.5" /><path d="M19 15H6l3.5 3.5" /></Ico> },
  deposit: { sub: "예금 금리", icon: <Ico><ellipse cx="12" cy="7" rx="7" ry="2.8" /><path d="M5 7v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V7" /><path d="M5 12v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5" /></Ico> },
  loan: { sub: "금리·대출 규제", icon: <Ico><path d="M18 6L6 18" /><circle cx="7.5" cy="7.5" r="2.3" /><circle cx="16.5" cy="16.5" r="2.3" /></Ico> },
  home: { sub: "청약·분양", icon: <Ico><path d="M4 11l8-6.5 8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></Ico> },
  house_price: { sub: "시세·세금", icon: <Ico><path d="M3.5 12L10 6.5l6.5 5.5" /><path d="M5.5 10.5V19h9v-8.5" /><path d="M19.5 19V9.5" /><path d="M17 12l2.5-2.5L22 12" /></Ico> },
};

/** 하는 일 칸 아이콘 */
const JOB_ICON: Record<string, ReactNode> = {
  it: <Ico><path d="M8.5 7.5L4 12l4.5 4.5" /><path d="M15.5 7.5L20 12l-4.5 4.5" /><path d="M13.5 5.5l-3 13" /></Ico>,
  finance: <Ico><path d="M3.5 9.5L12 4.5l8.5 5" /><path d="M5 19.5h14" /><path d="M6.5 10.5v6.5M10.5 10.5v6.5M13.5 10.5v6.5M17.5 10.5v6.5" /></Ico>,
  maker: <Ico><path d="M3.5 20V10l5 3V10l5 3V7l7 3v10z" /><path d="M8 17h2M13 17h2" /></Ico>,
  public: <Ico><path d="M2.5 9.5L12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5v4.2c1.4 1.5 3.3 2.3 5.5 2.3s4.1-.8 5.5-2.3v-4.2" /><path d="M21.5 9.5v5" /></Ico>,
  service: <Ico><path d="M5 8h14l-1 12H6z" /><path d="M9 10V7a3 3 0 016 0v3" /></Ico>,
  bio: <Ico><path d="M3 12h4l2-4.5 4 9 2-4.5h6" /></Ico>,
  build: <Ico><path d="M7 21V4h1.5L19 8H7" /><path d="M17 8v4" /><path d="M15.5 12h3v2.5h-3z" /><path d="M3.5 21h7" /></Ico>,
  logistics: <Ico><path d="M3 6.5h11v9.5H3z" /><path d="M14 9.5h4l3 3.5v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></Ico>,
  etc: <Ico><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></Ico>,
};

/**
 * 맨 위 단계 막대(카드 → 요즘 신경 쓰는 것, 2단계). 둘째 단계엔 이전(‹, 휴대폰 뒤로 가기와 같다)
 */
function StepBar({ step, onBack }: { step: 1 | 2; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 pb-1 pl-2 pr-5 pt-[max(8px,env(safe-area-inset-top))]">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="이전" className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-snow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <span className="h-11 w-3 shrink-0" />
      )}
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} aria-label={`2단계 중 ${step}단계`}>
        <span className="h-1 flex-1 rounded-full bg-mango" />
        <span className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-mango" : "bg-line"}`} />
      </div>
    </div>
  );
}

/**
 * 카드 다음 한 화면(2026-11-13 사용자: 온보딩에서 받되, 이 정보를 주면 무엇이 좋은지 한 줄로 / 선택 UI가 허접하다).
 * 경제 부문은 2열 칸: 아이콘 옆에 이름, 그 밑에 짚을 소식 한 줄(2026-11-13 사용자). 고르면 남색으로 차고 아이콘 자리가 망고,
 * 아이콘 모서리에 체크. 개수 제한은 없다(사용자 '관심사 제한 두지마, 많이 알수록 인사이트 분석하기 좋다'). 처음엔 2개까지·고른 차례 번호였다.
 * 하는 일은 3열 작은 칸에서 하나. 둘 다 건너뛸 수 있다(고르지 않고 시작하기)
 */
function FocusStep({
  name,
  focus,
  job,
  busy,
  onFocus,
  onJob,
  onBack,
  onStart,
}: {
  name: string | null;
  focus: string[];
  job: string | null;
  busy: boolean;
  onFocus: (v: string) => void;
  onJob: (v: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const picked = focus.length + (job ? 1 : 0);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <StepBar step={2} onBack={onBack} />
      <header className="flex items-center gap-3 px-5 pb-1 pt-2">
        <Mascot mood={picked >= 1 ? "cheer" : "listen"} className="size-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold leading-snug tracking-[-0.04em]">요즘 신경 쓰는 건요?</h1>
          {/* 2026-11-13 사용자 문구. '사용자'는 프로필 이름으로 부른다 */}
          <p className="text-[14px] font-medium text-sub text-balance">고르면 {name ? `${name}님의 ` : ""}맞춤 인사이트를 더 정확하게 분석해 드릴 수 있어요</p>
        </div>
      </header>

      <div className="flex flex-col gap-8 px-5 pb-36 pt-6">
        <section aria-labelledby="focus-econ">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="focus-econ" className="text-[16px] font-bold tracking-[-0.02em]">
              관심 있는 경제 부문
            </h2>
            <span className="text-[13px] font-medium text-sub">여러 개 골라도 돼요</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5" role="group" aria-labelledby="focus-econ">
            {FOCUS.options.map((o) => {
              const on = focus.includes(o.value);
              const look = FOCUS_LOOK[o.value];
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => onFocus(o.value)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                    on ? "border-ink bg-ink" : "border-line bg-paper"
                  }`}
                >
                  <span className={`relative flex size-10 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-150 ${on ? "bg-mango text-[#1F2340]" : "bg-snow text-ink"}`}>
                    {look?.icon}
                    {on && (
                      <span aria-hidden="true" className="pop absolute -right-1.5 -top-1.5 flex size-[19px] items-center justify-center rounded-full bg-paper text-ink ring-2 ring-ink">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15.5px] font-bold leading-tight tracking-[-0.03em] ${on ? "text-paper" : "text-ink"}`}>{o.label}</span>
                    {look && <span className={`mt-1 block text-[12px] font-medium leading-snug ${on ? "text-paper/70" : "text-sub"}`}>{look.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="focus-job">
          <h2 id="focus-job" className="mb-3 text-[16px] font-bold tracking-[-0.02em]">
            하는 일
          </h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="focus-job">
            {JOB.options.map((o) => {
              const on = job === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => onJob(o.value)}
                  className={`relative flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-[16px] border px-1 text-center transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                    on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
                  }`}
                >
                  {JOB_ICON[o.value]}
                  <span className="text-[13.5px] font-semibold leading-tight tracking-[-0.02em]">{o.label}</span>
                  {on && (
                    <span aria-hidden="true" className="pop absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-mango text-[#1F2340]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <p className="px-1 text-[12.5px] font-medium text-sub">고른 것은 설정 &gt; 맞춤 인사이트에서 바꾸거나 지울 수 있어요.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[528px]">
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[16px] font-bold text-paper disabled:bg-snow disabled:text-sub"
          >
            {picked >= 1 ? "시작하기" : "건너뛰고 시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

/**
 * 관심사를 찾는 동안(2.4초, 2026-11-13 사용자: 좀 동적으로, 관심사 더미를 뒤지고 분석하는 것처럼 맹고 애니메이션).
 * 분야 칩이 차례로 톡톡 나타나고(60ms 간격), 고른 분야는 하나씩 커졌다 돌아온다(맹고가 훑는 것처럼), 고르지 않은 분야는 옅어진다.
 * 가운데 맹고는 더미를 뒤지고(BusyMango) 돋보기가 이리저리 훑는다. 제목은 '관심사 더미를 뒤지고 있어요' → '맞춤 소식을 고르고 있어요'. globals.css find-*
 */
function Finding({ picked }: { picked: Set<string> }) {
  // 분야 9개의 자리(2026-11-11 부동산 추가)
  const spots = [
    "left-[8%] top-[6%]",
    "right-[10%] top-0",
    "left-[2%] top-[42%]",
    "right-[3%] top-[32%]",
    "left-[12%] bottom-[8%]",
    "right-[10%] bottom-[2%]",
    // 맹고 앞 종이 더미와 겹치지 않게 오른쪽으로(2026-11-13)
    "right-[2%] bottom-[24%]",
    "left-[40%] top-0",
    "left-[30%] bottom-0",
  ];
  let hit = 0;
  return (
    <div className="mx-auto flex h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="relative h-[340px] w-full">
        {SECTIONS.map((s, i) => {
          const on = picked.has(s.id);
          const order = on ? hit++ : 0;
          return (
            <span key={s.id} className={`find-chip absolute ${spots[i]}`} style={{ "--find-i": i } as CSSProperties}>
              <span
                className={`block rounded-full px-3.5 py-1.5 text-[14px] ${on ? "find-chip-hit bg-mango font-bold text-ink" : "find-chip-dim bg-snow font-semibold text-faint"}`}
                style={on ? ({ "--find-hit": order } as CSSProperties) : undefined}
              >
                {s.label}
              </span>
            </span>
          );
        })}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <BusyMango scale={2.4} />
          <svg viewBox="0 0 64 64" aria-hidden="true" className="find-lens absolute -left-5 -top-3 size-20">
            <circle cx="34" cy="30" r="18" fill="#E1F2FF" fillOpacity="0.7" stroke="#1F2340" strokeWidth="5" />
            <path d="M25 23 Q29 17 37 17" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <path d="M21 43 L8 56" stroke="#1F2340" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <h1 role="status" className="mt-4 grid text-[23px] font-bold tracking-[-0.04em]">
        <span className="making-line [grid-area:1/1]" style={{ "--making-at": "0s", "--making-for": "1.2s" } as CSSProperties}>
          관심사 더미를 뒤지고 있어요
        </span>
        <span className="making-line making-line-last [grid-area:1/1]" style={{ "--making-at": "1.2s", "--making-for": "1s" } as CSSProperties}>
          맞춤 소식을 고르고 있어요
        </span>
      </h1>
    </div>
  );
}
