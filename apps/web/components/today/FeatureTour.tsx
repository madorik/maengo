"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";

/**
 * 처음 온 회원(가입 선물이 있는 7일)에게 오늘 화면의 기능을 한 단계씩 짚어 준다(2026-11-06 사용자 결정).
 * 이게 먼저고, 끝나면(건너뛰어도) 가입 축하 팝업(SignupGift, '무료로 시작해보기')이 뜬다. 한 번만, 본 것은 이 기기에만 남긴다.
 * 짚을 곳은 data-tour 속성으로 찾는다: 전체 듣기(TodayList ListenAll), 첫 소식 카드, 플레이어(ListenWidget), 계정 메뉴(AccountMenu).
 * 맹고 AI는 소식 화면에만 있어서 첫 카드를 짚고 버튼 모양을 카드 안에 그려 보인다.
 * 화면에서 못 찾은 곳은 짚지 않고 안내 카드만 아래에 띄운다
 */

const TOUR_KEY = "maengo_feature_tour_seen";

type Step = {
  target: string;
  title: string;
  body: string;
  askPreview?: boolean;
};

function steps(audio: boolean): Step[] {
  return [
    {
      target: "listen-all",
      title: "오늘 소식을 귀로 들어요",
      body: audio ? "전체 듣기를 누르면 오늘 소식을 처음부터 차례로 읽어 드려요. 출퇴근길이나 손이 바쁠 때 좋아요." : "전체 듣기는 Premium에서 돼요. Free도 하루 1개는 무료로 들을 수 있어요.",
    },
    {
      target: "card",
      title: "소식을 누르면 자세히 봐요",
      body: "핵심 요약과 원문 링크가 있어요. 소식 화면을 옆으로 넘기면 다음 소식으로 가요.",
    },
    {
      target: "card",
      title: "궁금한 건 맹고 AI에게 물어요",
      body: "소식 화면 오른쪽 아래 AI 버튼을 누르면 그 소식에 대해 무엇이든 물어볼 수 있어요. 말로 물어도 돼요.",
      askPreview: true,
    },
    {
      target: "player",
      title: "플레이어는 여기 있어요",
      body: "누르면 플레이어가 펼쳐져요. 다른 화면으로 옮겨도 계속 들리고, 듣는 속도도 바꿀 수 있어요.",
    },
    {
      target: "account",
      title: "관심 분야는 설정에서 바꿔요",
      body: "프로필을 누르고 설정으로 가면 관심 분야를 더하거나 뺄 수 있어요. 고른 분야에서만 소식을 골라요.",
    },
    {
      target: "account",
      title: "소식 받는 시간도 정해요",
      body: "설정에서 알림 시각을 정하면 매일 그 시각에 새 소식을 보내 드려요.",
    },
  ];
}

const subscribe = () => () => {};
const tourSeenHere = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // 저장소를 못 쓰면 매번 뜨지 않게 본 것으로
  }
};

/** 화면에 보이는 첫 짚을 곳(넓은 화면과 좁은 화면에 같은 버튼이 둘 있을 수 있다) */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** 스크롤해도 제자리인 곳(위 막대·떠 있는 플레이어)인지 */
function isPinned(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const EDGE = 6;

/** 이 기기에서 기능 안내를 이미 봤는지(가입 축하 팝업은 그 뒤에 뜬다). 서버에서는 아직 안 본 것으로 */
export function useTourSeen(): boolean {
  return useSyncExternalStore(subscribe, tourSeenHere, () => false);
}

export function FeatureTour({ onDone }: { /** 끝났을 때(건너뛰어도). 가입 축하 팝업을 이어 띄운다 */ onDone: () => void }) {
  const { audio } = useProfile();
  // 서버에서는 그리지 않는다(봤는지는 이 기기만 안다)
  const seen = useSyncExternalStore(subscribe, tourSeenHere, () => true);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const list = useMemo(() => steps(audio), [audio]);
  const show = !seen && !done;
  const s = list[step];
  const target = s.target;

  useEffect(() => {
    const d = ref.current;
    if (show && d && !d.open) d.showModal();
  }, [show]);

  // 단계마다: 짚을 곳을 화면 위쪽으로 옮기고(떠 있는 것은 그대로), 스크롤·크기 바뀜을 따라간다
  useEffect(() => {
    if (!show) return;
    const el = findTarget(target);
    if (el && !isPinned(el)) {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96),
        behavior: reduce ? "auto" : "smooth",
      });
    }
    const measure = () => {
      const t = findTarget(target);
      if (!t) return setRect(null);
      // 화면 끝에 붙은 버튼(프로필·플레이어)도 테두리가 잘리지 않게 안쪽으로(테두리 4px + 여유 2px)
      const r = t.getBoundingClientRect();
      const left = Math.max(EDGE, r.left - PAD);
      const top = Math.max(EDGE, r.top - PAD);
      const right = Math.min(window.innerWidth - EDGE, r.right + PAD);
      const bottom = Math.min(window.innerHeight - EDGE, r.bottom + PAD);
      setRect({ top, left, width: right - left, height: bottom - top });
    };
    let raf = 0;
    const follow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    follow();
    const settle = setTimeout(follow, 450);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    nextRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [show, step, target]);

  if (!show) return null;

  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setDone(true);
    onDone();
  };
  const last = step === list.length - 1;
  const next = () => (last ? ref.current?.close() : setStep(step + 1));

  // 안내 카드 자리: 짚은 곳이 화면 위쪽이면 그 아래, 아래쪽이면 그 위. 못 찾았으면 화면 아래
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = rect ? rect.top + rect.height / 2 < vh * 0.55 : false;
  const cardPos: React.CSSProperties = !rect
    ? { bottom: "max(24px, env(safe-area-inset-bottom))" }
    : below
      ? { top: Math.min(rect.top + rect.height + 12, vh - 260) }
      : { bottom: Math.max(vh - rect.top + 12, 16) };

  return (
    <dialog
      ref={ref}
      aria-labelledby="feature-tour-title"
      aria-describedby="feature-tour-body"
      onClose={finish}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      {/* 짚은 곳만 밝게: 둘레 그림자로 나머지를 어둡게 덮는다 */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed shadow-[0_0_0_9999px_rgb(31_35_64/0.62)] ring-4 ring-mango motion-safe:transition-[top,left,width,height,border-radius] motion-safe:duration-300"
          // 작은 동그란 버튼(프로필·플레이어·전체 듣기)은 알약 모양으로, 카드는 카드 모서리에 맞춘다
          style={{ ...rect, borderRadius: Math.min(rect.width, rect.height) < 80 ? 9999 : 22 }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[rgb(31_35_64/0.62)]" />
      )}

      <div className="fixed inset-x-4 mx-auto max-w-[380px]" style={cardPos}>
        <div key={step} className="pop rounded-[24px] bg-paper p-5 text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
          {s.askPreview && (
            <div aria-hidden="true" className="mb-3 flex items-center gap-3 rounded-2xl bg-snow px-3 py-2.5">
              {/* 소식 화면의 맹고 AI 버튼(AskDock)과 같은 모양 */}
              <span className="relative flex rounded-full border-2 border-line bg-paper p-1">
                <span className="flex size-10 items-center justify-center rounded-full bg-mango-tint">
                  <Mascot className="size-8" />
                </span>
                <span className="absolute -left-1 -top-1 rounded-full border-2 border-paper bg-sky px-1.5 py-0.5 font-round text-[10px] font-black leading-none text-white">AI</span>
              </span>
              <span className="text-[14px] font-extrabold text-sub">소식 화면 오른쪽 아래</span>
            </div>
          )}
          <h2 id="feature-tour-title" className="text-[19px] font-black leading-snug tracking-[-0.03em]">
            {s.title}
          </h2>
          <p id="feature-tour-body" className="mt-1.5 text-[15px] font-semibold leading-relaxed text-sub">
            {s.body}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div aria-hidden="true" className="flex items-center gap-1.5">
              {list.map((_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-5 bg-mango-deep" : "w-2 bg-line-dark"}`} />
              ))}
            </div>
            <span className="sr-only">{`${list.length}단계 중 ${step + 1}단계`}</span>
            <div className="flex items-center gap-1">
              {!last && (
                <button type="button" onClick={() => ref.current?.close()} className="min-h-11 px-3 text-[15px] font-extrabold text-sub hover:underline">
                  건너뛰기
                </button>
              )}
              <button ref={nextRef} type="button" onClick={next} className="btn min-h-11 px-5 text-[15px]">
                {last ? "시작하기" : "다음"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
