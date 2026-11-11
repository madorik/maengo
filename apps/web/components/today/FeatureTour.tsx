"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useProfile } from "@/components/providers/ProfileProvider";
import { stripBase } from "@/lib/base-path";

/**
 * 처음 온 회원(가입 선물이 있는 7일)에게 기능을 실제 화면으로 옮겨 가며 한 단계씩 짚어 준다(2026-11-06 사용자 결정).
 * 오늘 소식(전체 듣기·플레이어·소식 카드) → 첫 소식 화면(맹고 AI 버튼) → 설정(관심사·알림 시각) → 오늘 소식으로 돌아온다.
 * 이게 먼저고, 끝나면(건너뛰어도) 가입 축하 팝업(SignupGift, '무료로 시작해보기')이 뜬다. 한 번만, 본 것은 이 기기에만 남긴다.
 * 시작은 오늘 화면(TodayList startTour), 그리기는 (app) 레이아웃의 TourHost라 화면을 옮겨도 이어진다.
 * 진행 단계는 sessionStorage에 두어 새로 고침해도 이어 간다. 짚을 곳을 못 찾으면 짚지 않고 안내 카드만 띄운다
 */

const TOUR_KEY = "maengo_feature_tour_seen";
const STATE_KEY = "maengo_feature_tour_state";

type Page = "today" | "article" | "settings";
type Step = { page: Page; target: string; title: string; body: string };

function steps(audio: boolean, dailyListens: number): Step[] {
  return [
    {
      page: "today",
      target: '[data-tour="listen-all"]',
      title: "브리핑을 귀로 들어요",
      // Free도 하루 몫 안에서 전체 듣기를 쓴다(2026-11-09). 2026-11-10 하루 두 번(출근길·퇴근길) 브리핑으로
      body: audio
        ? "브리핑 듣기를 누르면 소식을 처음부터 차례로 읽어 드려요. 출퇴근길이나 손이 바쁠 때 좋아요."
        : dailyListens > 0
          ? `브리핑 듣기를 누르면 소식을 차례로 읽어 드려요. Free는 하루 ${dailyListens}개까지 들을 수 있어요.`
          : "브리핑 듣기는 Premium에서 돼요.",
    },
    {
      page: "today",
      target: '[data-tour="player"]',
      title: "플레이어는 여기 있어요",
      body: "누르면 플레이어가 펼쳐져요. 다른 화면으로 옮겨도 계속 들리고, 듣는 속도도 바꿀 수 있어요.",
    },
    {
      page: "today",
      target: '[data-tour="card"]',
      title: "소식을 누르면 자세히 봐요",
      body: "핵심 요약과 원문 링크가 있어요. 소식 화면을 옆으로 넘기면 다음 소식으로 가요. 이 소식을 열어 볼게요.",
    },
    {
      page: "article",
      target: '[data-tour="ask"]',
      title: "궁금한 건 바로 물어봐요",
      body: "이 버튼을 누르면 지금 보는 소식에 대해 무엇이든 물어볼 수 있어요. 말로 물어도 돼요.",
    },
    {
      page: "settings",
      target: "#notify",
      title: "소식 받는 시간을 정해요",
      body: "출근길·퇴근길 브리핑을 정한 시각에 보내 드려요.",
    },
  ];
}

// ---------- 진행 상태(화면을 옮겨도 이어지게 모듈에 두고, 새로 고침에 대비해 sessionStorage에도) ----------

type TourState = { step: number; article: string | null } | null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function load(): TourState {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "null") as TourState;
  } catch {
    return null;
  }
}
let state: TourState = load();
function setTour(next: TourState) {
  state = next;
  try {
    if (next) sessionStorage.setItem(STATE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STATE_KEY);
  } catch {}
  listeners.forEach((l) => l());
}
const tourSeenHere = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // 저장소를 못 쓰면 매번 뜨지 않게 본 것으로
  }
};

/** 오늘 화면에서 처음 온 회원이면 부른다. 이미 봤거나 진행 중이면 아무것도 안 한다 */
export function startTour() {
  if (state || tourSeenHere()) return;
  setTour({ step: 0, article: null });
}

/** 이 기기에서 기능 안내를 이미 봤는지(가입 축하 팝업은 그 뒤에 뜬다). 끝나는 순간 바뀐다. 서버에서는 안 본 것으로 */
export function useTourSeen(): boolean {
  return useSyncExternalStore(subscribe, tourSeenHere, () => false);
}

// ---------- 그리기 ----------

/** 화면에 보이는 첫 짚을 곳(넓은 화면과 좁은 화면에 같은 버튼이 둘 있을 수 있다) */
function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** 스크롤해도 제자리인 곳(위 막대·떠 있는 버튼)인지 */
function isPinned(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

const PATHS: Partial<Record<Page, string>> = { today: "/today", settings: "/settings" };
const pathOf = (page: Page, article: string | null) => PATHS[page] ?? article ?? "/today";

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const EDGE = 6;

/** (app) 레이아웃에 하나. 진행 중인 기능 안내를 어느 화면에서든 그린다 */
export function TourHost() {
  const { audio, dailyListens } = useProfile();
  const tour = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  const router = useRouter();
  const pathname = usePathname();
  const list = useMemo(() => steps(audio, dailyListens), [audio, dailyListens]);
  const [rect, setRect] = useState<Rect | null>(null);
  // 짚을 곳을 찾고 자리를 잡은 단계(그 전에는 카드를 숨기고 화면만 어둡게)
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const navigatedFor = useRef<number | null>(null);

  const s = tour ? list[tour.step] : null;
  const want = s && tour ? pathOf(s.page, tour.article) : null;
  const here = want !== null && pathname === want;
  const key = tour && s ? `${tour.step}:${pathname}` : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tour && !d.open) d.showModal();
    if (!tour && d.open) d.close();
  }, [tour]);

  // 단계마다: 그 화면으로 옮기고, 짚을 곳이 그려질 때까지 기다렸다가 위쪽으로 스크롤하고 자리를 따라간다
  useEffect(() => {
    if (!tour || !s || !want || !key) return;
    if (!here) {
      if (navigatedFor.current !== tour.step) {
        navigatedFor.current = tour.step;
        router.push(want);
      }
      return;
    }
    let raf = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el) return setRect(null);
      // 화면 끝에 붙은 버튼도 테두리가 잘리지 않게 안쪽으로, 긴 묶음(설정)은 윗부분만
      const r = el.getBoundingClientRect();
      const left = Math.max(EDGE, r.left - PAD);
      const top = Math.max(EDGE, r.top - PAD);
      const right = Math.min(window.innerWidth - EDGE, r.right + PAD);
      const bottom = Math.min(window.innerHeight - EDGE, r.bottom + PAD, top + window.innerHeight * 0.42);
      setRect({ top, left, width: right - left, height: Math.max(0, bottom - top) });
    };
    const follow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    let tries = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const poll = setInterval(() => {
      el = findTarget(s.target);
      if (!el && ++tries < 40) return;
      clearInterval(poll);
      if (el && !isPinned(el)) {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96), behavior: reduce ? "auto" : "smooth" });
      }
      follow();
      settle = setTimeout(() => {
        follow();
        setReadyFor(key);
        nextRef.current?.focus();
      }, 400);
    }, 100);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      clearInterval(poll);
      clearTimeout(settle);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [tour, s, want, here, key, router]);

  const finish = () => {
    if (!state) return;
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setTour(null);
    navigatedFor.current = null;
    if (pathname !== "/today") router.push("/today");
  };

  const next = () => {
    if (!tour) return;
    if (tour.step === list.length - 1) return finish();
    // 소식 카드 다음: 그 카드의 소식 화면으로(못 찾으면 맹고 AI 단계는 건너뛴다)
    let article = tour.article;
    let step = tour.step + 1;
    if (list[step].page === "article" && !article) {
      const href = findTarget('[data-tour="card"]')?.querySelector('a[href*="/article/"]')?.getAttribute("href");
      article = href ? stripBase(href) : null;
      if (!article) step += 1;
    }
    setTour({ step, article });
  };

  const ready = readyFor === key && here;
  const last = tour ? tour.step === list.length - 1 : false;
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
      {ready && rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed shadow-[0_0_0_9999px_rgb(31_35_64/0.62)] ring-4 ring-mango motion-safe:transition-[top,left,width,height,border-radius] motion-safe:duration-300"
          // 작은 동그란 버튼(플레이어·맹고 AI·전체 듣기)은 알약 모양으로, 카드·묶음은 카드 모서리에 맞춘다
          style={{ ...rect, borderRadius: Math.min(rect.width, rect.height) < 80 ? 9999 : 22 }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[rgb(31_35_64/0.62)]" />
      )}

      {s && tour && ready && (
        <div className="fixed inset-x-4 mx-auto max-w-[380px]" style={cardPos}>
          <div key={tour.step} className="pop rounded-[24px] bg-paper p-5 text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
            <h2 id="feature-tour-title" className="text-[19px] font-black leading-snug tracking-[-0.03em]">
              {s.title}
            </h2>
            <p id="feature-tour-body" className="mt-1.5 text-[15px] font-semibold leading-relaxed text-sub">
              {s.body}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div aria-hidden="true" className="flex items-center gap-1.5">
                {list.map((_, i) => (
                  <span key={i} className={`h-2 rounded-full transition-all ${i === tour.step ? "w-5 bg-mango-deep" : "w-2 bg-line-dark"}`} />
                ))}
              </div>
              <span className="sr-only">{`${list.length}단계 중 ${tour.step + 1}단계`}</span>
              <div className="flex items-center gap-1">
                {!last && (
                  <button type="button" onClick={finish} className="min-h-11 px-3 text-[15px] font-extrabold text-sub hover:underline">
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
      )}
    </dialog>
  );
}
