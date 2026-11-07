"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Crown, IconCheck, IconExternal, IconNext, IconPause, IconPlay, IconPrev, IconSpeaker } from "@/components/icons";
import { useSignedIn } from "@/components/landing/AuthLink";
import { MangoIcon } from "@/components/MangoIcon";
import { Mascot } from "@/components/Mascot";
import { SeekBar } from "@/components/listen/SeekBar";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { Confetti } from "@/components/ui/Confetti";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { formatClock } from "@/lib/player/machine";
import { AFTER_LOGIN_COOKIE } from "@/lib/session-cookie";
import type { GuestItem } from "@/lib/types";

// 로그인 없이 둘러보기(/try, 2026-11-07 사용자 결정). 이미 만든 음성이 있는 소식을 하나씩 듣고 넘긴다.
// 한 소식을 다 들으면 다음 소식으로 이어 가고, 마지막 소식 뒤(또는 '건너뛰기')에는 Premium 무료 체험을 권하는 끝 화면이 나온다.
// 소리는 화면에 하나 있는 오디오에서 난다(iOS는 처음 누를 때 play()를 걸어 둔 오디오만 이어서 틀 수 있다).

/** 끝 화면에 늘어놓는 Premium 장점(app/try/page.tsx가 plans 표 숫자로 만든다) */
export interface TourPerk {
  label: string;
  /** Free와 견주는 짧은 말(옅게) */
  note?: string;
}

type Status = "idle" | "loading" | "playing" | "paused" | "error";

/** 손으로 올리고 내린 뒤 이 시간 동안은 읽는 줄로 끌고 오지 않는다(듣기 창 대본과 같은 값) */
const HOLD_MS = 4000;

const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

/** 지금 읽는 줄(시작 시각이 지난 마지막 줄). 시작 전이면 -1 */
function lineAt(lines: GuestItem["lines"], ms: number): number {
  let at = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i]!.startMs <= ms) at = i;
  return at;
}

const setAfterLogin = (value: "trial" | null) => {
  document.cookie = value ? `${AFTER_LOGIN_COOKIE}=${value}; path=/; max-age=86400; samesite=lax` : `${AFTER_LOGIN_COOKIE}=; path=/; max-age=0; samesite=lax`;
};

export function GuestTour({ items, perks, priceLabel, trialDays }: { items: GuestItem[]; perks: TourPerk[]; priceLabel: string; trialDays: number }) {
  const n = items.length;
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [posMs, setPosMs] = useState(0);
  /** 오디오에 걸린 소식(음성 키). 지금 소식과 다르면 그 소식은 아직 안 들은 모습 */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** 끝 화면에 보이는 들어 본 소식 수(끝 화면으로 갈 때 센다) */
  const [heardCount, setHeardCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stepRef = useRef(0);
  const heard = useRef(new Set<number>());
  const startedRef = useRef(false);
  const touchedAt = useRef(0);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  /** 다 들었을 때 할 일(오디오 이벤트는 처음 한 번만 붙이므로 늘 최신 함수를 부르게 ref로) */
  const onEndedRef = useRef<() => void>(() => {});

  const done = step >= n;
  const item = done ? null : items[step]!;
  const loaded = !!item && loadedKey === item.audioKey && status !== "idle";
  const active = loaded && item ? lineAt(item.lines, posMs) : -1;

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    const on = (type: string, fn: () => void) => a.addEventListener(type, fn);
    const time = () => setPosMs(a.currentTime * 1000);
    on("timeupdate", time);
    on("seeked", time);
    on("playing", () => setStatus("playing"));
    on("waiting", () => setStatus("loading"));
    on("pause", () => setStatus((s) => (s === "idle" || s === "error" ? s : "paused")));
    on("ended", () => onEndedRef.current());
    on("error", () => {
      // src를 비울 때도 error가 난다(지금 걸린 소식이 없으면 무시)
      if (a.getAttribute("src")) setStatus("error");
    });
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      audioRef.current = null;
    };
  }, []);

  /** i번째 소식을 튼다. 누르는 순간 부르는 것이라(iOS) 기다리지 않고 바로 play() */
  const playAt = (i: number, fromMs = 0) => {
    const a = audioRef.current;
    const it = items[i];
    if (!a || !it) return;
    if (a.dataset.key !== it.audioKey) {
      a.src = withBase(`/api/try/audio?key=${encodeURIComponent(it.audioKey)}`);
      a.dataset.key = it.audioKey;
      setPosMs(0);
    }
    if (fromMs > 0) a.currentTime = fromMs / 1000;
    setLoadedKey(it.audioKey);
    setStatus("loading");
    a.play().catch((e: DOMException) => {
      if (e.name === "AbortError") return;
      // 저절로 이어 틀기를 브라우저가 막으면 멈춘 모습으로 두고 누르길 기다린다
      setStatus(e.name === "NotAllowedError" ? "paused" : "error");
    });
    if (!startedRef.current) {
      startedRef.current = true;
      track("try_start", { items: n });
    }
    heard.current.add(it.clusterId);
  };

  /** i번째 소식으로 간다. n이면 끝 화면. play면 바로 튼다 */
  const goTo = (i: number, play: boolean) => {
    const a = audioRef.current;
    const next = Math.max(0, Math.min(n, i));
    stepRef.current = next;
    setStep(next);
    setPosMs(0);
    lineRefs.current = [];
    touchedAt.current = 0;
    window.scrollTo({ top: 0 });
    if (next >= n) {
      a?.pause();
      setStatus("idle");
      setLoadedKey(null);
      setHeardCount(heard.current.size);
      track("try_complete", { heard: heard.current.size, items: n });
      return;
    }
    if (play) return playAt(next);
    a?.pause();
    setStatus("idle");
  };

  // 다 들으면 다음 소식(마지막이면 끝 화면)으로 이어 간다
  useEffect(() => {
    onEndedRef.current = () => goTo(stepRef.current + 1, true);
  });

  // 읽는 줄을 화면 가운데로(손으로 넘겨 보는 중이면 잠시 두었다가). 움직임 줄이기를 켰으면 바로 옮긴다
  useEffect(() => {
    if (status !== "playing" || active < 1 || Date.now() - touchedAt.current < HOLD_MS) return;
    const el = lineRefs.current[active];
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [active, status]);

  useEffect(() => {
    const touch = () => {
      touchedAt.current = Date.now();
    };
    window.addEventListener("wheel", touch, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
    return () => {
      window.removeEventListener("wheel", touch);
      window.removeEventListener("touchmove", touch);
    };
  }, []);

  // 잠금 화면·이어폰 버튼(웹 브라우저)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !item || !loaded) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: "맹고", album: "둘러보기" });
  }, [item, loaded]);

  const seek = (ms: number) => {
    const a = audioRef.current;
    if (!a || !item) return;
    if (!loaded) return playAt(step, ms);
    a.currentTime = ms / 1000;
    setPosMs(ms);
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (status === "playing" || status === "loading") return a.pause();
    playAt(step);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[680px] items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-8" />
            <span className="text-[22px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
            <span className="rounded-full bg-mango-tint px-2 py-0.5 text-[12px] font-black text-mango-deep">둘러보기</span>
          </Link>
          {!done && (
            <div className="flex items-center gap-1">
              <span aria-hidden="true" className="font-round text-[15px] font-black tabular-nums text-sub">
                {step + 1}/{n}
              </span>
              <span className="sr-only">{`${n}개 중 ${step + 1}번째 소식`}</span>
              <button
                type="button"
                onClick={() => goTo(n, false)}
                className="inline-flex min-h-11 items-center rounded-xl px-2.5 text-[14px] font-extrabold text-sub hover:bg-snow"
              >
                건너뛰기
              </button>
            </div>
          )}
        </div>
        {/* 소식마다 한 칸(스토리처럼). 지금 칸은 들은 만큼 찬다 */}
        <div aria-hidden="true" className="mx-auto flex max-w-[680px] gap-1 px-4 pb-2.5">
          {items.map((it, i) => {
            const fill = done || i < step ? 1 : i === step && loaded ? Math.min(1, posMs / Math.max(1, it.durationMs)) : 0;
            return (
              <span key={it.clusterId} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-mango transition-[width] duration-300 ease-linear motion-reduce:transition-none" style={{ width: `${fill * 100}%` }} />
              </span>
            );
          })}
        </div>
      </header>

      {item ? (
        <>
          <article key={item.clusterId} className="mx-auto max-w-[680px] px-5 pb-[calc(var(--tour-bar-h,150px)+24px)] pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip category={item.category} />
              <span className="min-w-0 truncate text-[14px] font-bold text-sub">
                {item.sourceLabel} · {dayLabel(item.date)}
              </span>
            </div>
            <h1 className="mt-3 text-[24px] font-black leading-[1.35] tracking-[-0.03em] md:text-[28px]">{item.title}</h1>

            <section aria-label="요약" className="mt-5 flex items-start gap-2">
              <Mascot mood={status === "playing" ? "listen" : "happy"} className={`size-14 shrink-0 ${status === "playing" ? "bob" : ""}`} />
              <Bubble className="flex-1">
                <p className="text-[16px] font-bold leading-[1.65]">{item.short}</p>
              </Bubble>
            </section>

            {/* 대본: 읽는 줄을 진하게. 첫 줄(제목)은 위에 있어서 뺀다. 누르면 그 줄부터 듣는다 */}
            <section aria-label="대본" className="mt-7">
              {item.lines.map((line, i) => {
                if (i === 0) return null;
                const now = i === active;
                const newPara = i > 1 && line.para !== undefined && line.para !== item.lines[i - 1]!.para;
                return (
                  <button
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => seek(line.startMs)}
                    aria-current={now ? "true" : undefined}
                    className={`block w-full rounded-lg py-1 text-left text-[18px] font-extrabold leading-snug transition-colors duration-300 hover:bg-snow motion-reduce:transition-none ${newPara ? "mt-4" : ""} ${
                      now ? "text-ink" : loaded && i < active ? "text-faint" : "text-sub"
                    }`}
                  >
                    {line.text}
                  </button>
                );
              })}
            </section>

            <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-6 min-h-12 gap-1.5 px-5 text-[15px]">
              {item.kind === "video" ? "유튜브에서 보기" : "원문 보기"}
              <IconExternal className="size-4" />
              <span className="sr-only">(새 탭에서 열림)</span>
            </a>
          </article>

          <TourBar
            item={item}
            first={step === 0}
            last={step === n - 1}
            status={status}
            loaded={loaded}
            posMs={posMs}
            onToggle={toggle}
            onSeek={seek}
            onPrev={() => goTo(step - 1, status === "playing" || status === "loading")}
            onNext={() => goTo(step + 1, status === "playing" || status === "loading")}
            onRetry={() => {
              const a = audioRef.current;
              if (a) delete a.dataset.key;
              playAt(step);
            }}
          />
        </>
      ) : (
        <TourEnd heard={heardCount} total={n} perks={perks} priceLabel={priceLabel} trialDays={trialDays} onRestart={() => goTo(0, true)} />
      )}
    </div>
  );
}

/** 아래 고정 막대: 처음엔 '이 소식 듣기' 버튼 하나, 듣기 시작하면 진행 막대와 이전·재생·다음 */
function TourBar({
  item,
  first,
  last,
  status,
  loaded,
  posMs,
  onToggle,
  onSeek,
  onPrev,
  onNext,
  onRetry,
}: {
  item: GuestItem;
  first: boolean;
  last: boolean;
  status: Status;
  loaded: boolean;
  posMs: number;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  // 막대 높이만큼 본문 아래를 비운다(오류 줄이 붙으면 높아진다)
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--tour-bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty("--tour-bar-h");
    };
  }, []);

  const playing = status === "playing";
  const nav = "flex size-12 shrink-0 items-center justify-center rounded-full text-sub enabled:hover:bg-snow enabled:hover:text-ink disabled:opacity-30";
  const prev = (
    <button type="button" onClick={onPrev} disabled={first} aria-label="이전 소식" className={nav}>
      <IconPrev className="size-6" />
    </button>
  );
  const next = (
    <button type="button" onClick={onNext} aria-label={last ? "둘러보기 마치기" : "다음 소식"} className={nav}>
      <IconNext className="size-6" />
    </button>
  );

  return (
    <div ref={barRef} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-paper">
      <div className="mx-auto max-w-[680px] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        {status === "error" && (
          <div className="mb-2 flex items-center gap-2">
            <p role="alert" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-cherry">
              음성을 불러오지 못했어요.
            </p>
            <button type="button" onClick={onRetry} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
              다시 시도
            </button>
          </div>
        )}
        {loaded ? (
          <>
            <SeekBar valueMs={posMs} totalMs={item.durationMs} onSeek={onSeek} label="이 소식 재생 위치" className="h-3" />
            <div className="flex justify-between text-[12px] font-extrabold tabular-nums text-sub">
              <span>{formatClock(posMs)}</span>
              <span>{formatClock(item.durationMs)}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-6">
              {prev}
              <button
                type="button"
                onClick={onToggle}
                aria-label={playing ? "일시정지" : "이어서 듣기"}
                aria-busy={status === "loading" || undefined}
                className="btn btn-sky size-16 min-h-0 shrink-0 rounded-full p-0"
              >
                {status === "loading" ? <Spinner /> : playing ? <IconPause className="size-7" /> : <IconPlay className="size-8" />}
              </button>
              {next}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {prev}
            <button type="button" onClick={onToggle} className="btn btn-sky min-h-14 flex-1 text-[17px]">
              <IconSpeaker className="size-6" />이 소식 듣기
              <span className="font-round text-[15px] font-extrabold opacity-85">{formatClock(item.durationMs)}</span>
            </button>
            {next}
          </div>
        )}
      </div>
    </div>
  );
}

/** 끝 화면: 축하 + Premium 무료 체험 권유. 로그인한 사람은 바로 요금제로, 아니면 로그인 뒤 요금제로 간다(AFTER_LOGIN_COOKIE) */
function TourEnd({
  heard,
  total,
  perks,
  priceLabel,
  trialDays,
  onRestart,
}: {
  heard: number;
  total: number;
  perks: TourPerk[];
  priceLabel: string;
  trialDays: number;
  onRestart: () => void;
}) {
  const signedIn = useSignedIn();
  return (
    <main className="mx-auto max-w-[560px] px-5 pb-[calc(40px+env(safe-area-inset-bottom))] pt-6">
      <div aria-hidden="true" className="keep-light relative h-[156px] overflow-hidden rounded-3xl bg-mango-tint">
        <Confetti />
        <Mascot mood="cheer" className="pop absolute left-1/2 top-4 size-[124px] -translate-x-1/2" />
      </div>
      <h1 className="mt-6 text-center text-[26px] font-black leading-snug tracking-[-0.03em]">
        {heard > 0 ? `소식 ${heard}개를 들어 봤어요` : "둘러보기 끝!"}
      </h1>
      <p className="mt-2 text-center text-[16px] font-semibold leading-relaxed text-sub">
        가입하면 내가 고른 분야 소식만
        <br />
        매일 골라서 읽어 드려요.
      </p>

      <section aria-labelledby="tour-premium-title" className="relative mt-7 overflow-hidden rounded-3xl bg-[#1F2340] px-6 pb-6 pt-6 text-white shadow-[0_6px_0_#11142A] dark:ring-2 dark:ring-line">
        <span aria-hidden="true" className="absolute -right-12 -top-14 size-48 rounded-full bg-white/[0.06]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-black tracking-[0.08em] text-mango">
            <Crown className="size-3.5" />
            PREMIUM
          </span>
          <h2 id="tour-premium-title" className="mt-3 text-[24px] font-black leading-tight tracking-[-0.03em]">
            {trialDays}일 동안 무료로 써 보세요
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {perks.map((p) => (
              <li key={p.label} className="flex items-center gap-2.5 text-[16px] font-bold">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mango text-[#1F2340]">
                  <IconCheck className="size-4 [stroke-width:3]" />
                </span>
                <span className="min-w-0">
                  {p.label}
                  {p.note && <span className="ml-1.5 text-[13px] font-semibold text-white/60">{p.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={signedIn ? "/premium?trial=1" : "/login"}
            onClick={() => {
              if (!signedIn) setAfterLogin("trial");
              track("try_trial_click", { heard, items: total, signed_in: signedIn });
            }}
            className="btn mt-6 min-h-14 w-full text-[17px] no-underline"
          >
            Premium {trialDays}일 무료로 체험하기
          </Link>
          <p className="mt-3 text-center text-[13px] font-semibold leading-relaxed text-white/70">
            체험이 끝나기 전에 해지하면 결제되지 않아요. 그 뒤에는 {priceLabel}이에요.
          </p>
        </div>
      </section>

      <div className="mt-5 flex flex-col items-center gap-1">
        {!signedIn && (
          <Link href="/login" onClick={() => setAfterLogin(null)} className="btn btn-ghost min-h-12 w-full text-[16px] no-underline">
            무료로 시작하기
          </Link>
        )}
        <button type="button" onClick={onRestart} className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-extrabold text-sub hover:bg-snow">
          <IconPlay className="size-4" />
          처음부터 다시 듣기
        </button>
      </div>
    </main>
  );
}
