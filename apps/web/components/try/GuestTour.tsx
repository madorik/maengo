"use client";

import { CATEGORY_LABEL } from "@maengo/core/categories";
import { publishedLabel } from "@maengo/core/kst";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Crown, IconCheck, IconExternal, IconNext, IconPause, IconPlay, IconPrev, IconSpeaker } from "@/components/icons";
import { AuthLink, useSignedIn } from "@/components/landing/AuthLink";
import { MangoIcon } from "@/components/MangoIcon";
import { Mascot } from "@/components/Mascot";
import { SeekBar } from "@/components/listen/SeekBar";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { Confetti } from "@/components/ui/Confetti";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SourceChip } from "@/components/ui/SourceChip";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { formatClock } from "@/lib/player/machine";
import { AFTER_LOGIN_COOKIE } from "@/lib/session-cookie";
import type { GuestItem } from "@/lib/types";

// 로그인 없이 둘러보기(/try, 2026-11-07 사용자 결정). 오늘 화면(components/today/TodayList.tsx)과 같은 목록으로 보여 준다.
// 듣기를 누르면 그 소식부터 목록 끝까지 이어서 듣고(전체 듣기는 처음부터), 마지막 소식을 다 들으면 Premium 무료 체험 팝업이 뜬다.
// 목록 아래에도 같은 권유 카드를 둔다. 소리는 화면에 하나 있는 오디오에서 난다(iOS는 처음 누를 때 play()를 걸어 둔 오디오만 이어서 틀 수 있다).

/** 끝 화면에 늘어놓는 Premium 장점(app/try/page.tsx가 plans 표 숫자로 만든다) */
export interface TourPerk {
  label: string;
  /** Free와 견주는 짧은 말(옅게) */
  note?: string;
}

type Offer = { perks: TourPerk[]; priceLabel: string; trialDays: number };
type Status = "idle" | "loading" | "playing" | "paused" | "error";

const noSubscribe = () => () => {};
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

/** 화면에 하나 있는 오디오로 목록을 차례로 튼다. 한 소식이 끝나면 다음 소식, 마지막이 끝나면 onFinish(들어 본 소식 수) */
function useGuestPlayer(items: GuestItem[], onFinish: (heard: number) => void) {
  const n = items.length;
  const [cur, setCur] = useState(-1);
  const [status, setStatus] = useState<Status>("idle");
  const [posMs, setPosMs] = useState(0);
  /** 듣기 시작한 소식(카드의 '읽음'·들어 본 소식 막대) */
  const [heard, setHeard] = useState<ReadonlySet<number>>(() => new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const curRef = useRef(-1);
  /** 다 들었을 때 할 일(오디오 이벤트는 처음 한 번만 붙이므로 늘 최신 함수를 부르게 ref로) */
  const onEndedRef = useRef<() => void>(() => {});

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
  const play = (i: number, fromMs = 0) => {
    const a = audioRef.current;
    const it = items[i];
    if (!a || !it) return;
    if (a.dataset.key !== it.audioKey) {
      a.src = withBase(`/api/try/audio?key=${encodeURIComponent(it.audioKey)}`);
      a.dataset.key = it.audioKey;
      setPosMs(0);
    }
    if (fromMs > 0) a.currentTime = fromMs / 1000;
    curRef.current = i;
    setCur(i);
    setStatus("loading");
    a.play().catch((e: DOMException) => {
      if (e.name === "AbortError") return;
      // 저절로 이어 틀기를 브라우저가 막으면 멈춘 모습으로 두고 누르길 기다린다
      setStatus(e.name === "NotAllowedError" ? "paused" : "error");
    });
    setHeard((h) => (h.has(it.clusterId) ? h : new Set(h).add(it.clusterId)));
  };
  const pause = () => audioRef.current?.pause();
  const seek = (ms: number) => {
    const a = audioRef.current;
    if (!a || cur < 0) return;
    a.currentTime = ms / 1000;
    setPosMs(ms);
  };
  const retry = () => {
    const a = audioRef.current;
    if (a) delete a.dataset.key;
    play(Math.max(0, cur));
  };

  /** 다음 소식으로. 마지막이었으면 멈추고 끝(onFinish) */
  const next = () => {
    const i = curRef.current + 1;
    if (i < n) return play(i);
    audioRef.current?.pause();
    setStatus("idle");
    curRef.current = -1;
    setCur(-1);
    onFinish(heard.size);
  };

  useEffect(() => {
    onEndedRef.current = next;
  });

  return { cur, status, posMs, heard, play, pause, seek, retry, next };
}

export function GuestTour({ items, perks, priceLabel, trialDays }: { items: GuestItem[] } & Offer) {
  const n = items.length;
  const [finished, setFinished] = useState(false);
  const p = useGuestPlayer(items, (heard) => {
    setFinished(true);
    track("try_complete", { heard, items: n });
  });
  const started = useRef(false);
  const offer: Offer = { perks, priceLabel, trialDays };
  const playing = p.status === "playing" || p.status === "loading";
  const categories = [...new Set(items.map((i) => CATEGORY_LABEL[i.category]))];

  const start = (i: number, mode: "all" | "item") => {
    if (!started.current) {
      started.current = true;
      track("try_start", { items: n, mode });
    }
    p.play(i);
  };
  const listenAll = () => {
    if (playing) return p.pause();
    if (p.cur >= 0) return p.play(p.cur);
    start(0, "all");
  };

  // 잠금 화면·이어폰 버튼(웹 브라우저)
  const curItem = p.cur >= 0 ? items[p.cur] : undefined;
  useEffect(() => {
    if (!("mediaSession" in navigator) || !curItem) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: curItem.title, artist: "맹고", album: "둘러보기" });
  }, [curItem]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[640px] items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-8" />
            <span className="text-[22px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
          </Link>
          <AuthLink signedOut={{ href: "/login", label: "로그인" }} signedIn={{ href: "/today", label: "오늘의 소식" }} className="btn btn-ghost min-h-11 px-4 text-[14px] no-underline" />
        </div>
      </header>

      <main className={`mx-auto max-w-[640px] px-4 pt-5 lg:pt-8 ${curItem ? "pb-[calc(var(--tour-bar-h,140px)+24px)]" : "pb-[calc(40px+env(safe-area-inset-bottom))]"}`}>
        {/* 오늘 화면의 머리 카드와 같은 모양 */}
        <section aria-labelledby="try-title" className="keep-light rounded-2xl bg-mango px-5 pb-4 pt-4 shadow-[0_4px_0_var(--color-mango-dark)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-ink/70">로그인 없이 둘러보기</p>
              <h1 id="try-title" className="mt-0.5 text-[24px] font-black tracking-[-0.03em]">
                최근 소식 {n}개
              </h1>
            </div>
            <button
              type="button"
              onClick={listenAll}
              aria-label={playing ? "듣기 일시정지" : "소식 전체 듣기"}
              className="btn btn-ink mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 px-4 text-[14px]"
            >
              {playing ? <IconPause className="size-4" /> : <IconPlay className="size-4" />}
              {playing ? "일시정지" : p.cur >= 0 ? "이어 듣기" : "전체 듣기"}
            </button>
          </div>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-ink/80">{categories.join(", ")}에서 골랐어요</p>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={p.heard.size / n} tone="leaf" label="들어 본 소식" className="h-4 flex-1" track="bg-white/60" />
            <span className="font-round text-[17px] font-black tabular-nums">{`${p.heard.size}/${n}`}</span>
          </div>
        </section>

        <ol className="mt-6 flex flex-col gap-4" aria-label="최근 소식">
          {items.map((item, i) => (
            <GuestCard
              key={item.clusterId}
              item={item}
              current={p.cur === i}
              status={p.cur === i ? p.status : "idle"}
              posMs={p.cur === i ? p.posMs : 0}
              heard={p.heard.has(item.clusterId)}
              onListen={() => (p.cur === i && playing ? p.pause() : p.cur === i ? p.play(i) : start(i, "item"))}
              onLine={(ms) => (p.cur === i ? p.seek(ms) : start(i, "item"))}
            />
          ))}
        </ol>

        <PremiumOffer offer={offer} where="list" heard={p.heard.size} total={n} className="mt-8" />
      </main>

      {curItem && (
        <MiniPlayer
          item={curItem}
          index={p.cur}
          total={n}
          status={p.status}
          posMs={p.posMs}
          onToggle={() => (playing ? p.pause() : p.play(p.cur))}
          onSeek={p.seek}
          onPrev={() => p.play(Math.max(0, p.cur - 1))}
          onNext={p.next}
          onRetry={p.retry}
        />
      )}

      {finished && <FinishDialog offer={offer} heard={p.heard.size} total={n} onClose={() => setFinished(false)} />}
    </div>
  );
}

/** 소식 카드(오늘 목록의 카드와 같은 모양). 누르면 대본이 펼쳐지고, 읽는 줄을 진하게 보여 준다 */
function GuestCard({
  item,
  current,
  status,
  posMs,
  heard,
  onListen,
  onLine,
}: {
  item: GuestItem;
  current: boolean;
  status: Status;
  posMs: number;
  heard: boolean;
  onListen: () => void;
  onLine: (ms: number) => void;
}) {
  const [open, setOpen] = useState(false);
  // '오늘 오전 9시' 같은 말은 브라우저에서(페이지는 10분마다 새로 만들어 서버에서 만들면 늦는다). 서버에서는 날짜만
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const when = mounted ? publishedLabel(item.date) : dayLabel(item.date);
  const preparing = current && status === "loading";
  const playing = current && status === "playing";
  const active = current ? lineAt(item.lines, posMs) : -1;
  const body = `script-${item.clusterId}`;

  return (
    <li className={`tile relative p-4 transition-colors hover:bg-snow sm:p-5 ${current ? "border-sky" : ""}`}>
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={item.category} />
        <SourceChip item={item} />
        <span className="ml-auto shrink-0">
          {current && status === "error" ? (
            <span className="text-cherry">못 불러왔어요</span>
          ) : playing ? (
            <span className="text-sky">듣는 중</span>
          ) : heard && !current ? (
            <span className="inline-flex items-center gap-1 text-leaf">
              <IconCheck className="size-4 [stroke-width:3]" />
              읽음
            </span>
          ) : null}
        </span>
      </div>
      <h2 className="mt-2.5 text-[18px] font-black leading-snug tracking-[-0.02em]">
        {/* 카드 전체를 덮는 버튼(대본 펼치기). 듣기 버튼과 펼친 대본만 그 위에 올라온다 */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={body}
          className={`text-left after:absolute after:inset-0 after:rounded-2xl ${heard && !current ? "text-sub" : ""}`}
        >
          {item.title}
        </button>
      </h2>
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">{item.short}</p>

      {open && (
        <div id={body} className="relative z-10 mt-4 border-t-2 border-line pt-3">
          {item.lines.map((line, i) => {
            if (i === 0) return null;
            const now = i === active;
            const newPara = i > 1 && line.para !== undefined && line.para !== item.lines[i - 1]!.para;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onLine(line.startMs)}
                aria-current={now ? "true" : undefined}
                className={`block w-full rounded-lg py-0.5 text-left text-[16px] font-bold leading-relaxed transition-colors duration-300 hover:bg-snow motion-reduce:transition-none ${newPara ? "mt-3" : ""} ${
                  now ? "text-ink" : current && i < active ? "text-faint" : "text-sub"
                }`}
              >
                {line.text}
              </button>
            );
          })}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-[14px] font-extrabold text-sky-dark no-underline hover:underline">
            {item.kind === "video" ? "유튜브에서 보기" : "원문 보기"}
            <IconExternal className="size-4" />
            <span className="sr-only">(새 탭에서 열림)</span>
          </a>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <p className="min-w-0 truncate text-[13px]">
          <span className="font-extrabold">{item.author}</span>
          <span className="ml-2 font-semibold text-faint">{when}</span>
        </p>
        <button
          type="button"
          onClick={onListen}
          aria-label={playing || preparing ? `${item.title} 그만 듣기` : `${item.title} 듣기`}
          className="btn btn-ghost relative z-10 ml-auto min-h-11 shrink-0 px-3 text-[14px]"
        >
          {preparing ? <Spinner /> : playing ? <IconPause className="size-4 text-sky" /> : <IconSpeaker className="size-5 text-sky" />}
          {playing || preparing ? "멈춤" : "듣기"}
        </button>
      </div>
    </li>
  );
}

/** 듣는 동안 아래에 붙는 플레이어: 지금 소식 제목, 진행 막대, 이전·재생·다음 */
function MiniPlayer({
  item,
  index,
  total,
  status,
  posMs,
  onToggle,
  onSeek,
  onPrev,
  onNext,
  onRetry,
}: {
  item: GuestItem;
  index: number;
  total: number;
  status: Status;
  posMs: number;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  // 막대 높이만큼 목록 아래를 비운다(오류 줄이 붙으면 높아진다)
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
  const nav = "flex size-11 shrink-0 items-center justify-center rounded-full text-sub enabled:hover:bg-snow enabled:hover:text-ink disabled:opacity-30";

  return (
    <div ref={barRef} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-paper">
      <div className="mx-auto max-w-[640px] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
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
        <p className="truncate text-[14px] font-extrabold">
          <span className="mr-1.5 font-round tabular-nums text-sky-dark">
            {index + 1}/{total}
          </span>
          {item.title}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={onPrev} disabled={index === 0} aria-label="이전 소식" className={nav}>
            <IconPrev className="size-5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? "일시정지" : "이어서 듣기"}
            aria-busy={status === "loading" || undefined}
            className="btn btn-sky size-12 min-h-0 shrink-0 rounded-full p-0"
          >
            {status === "loading" ? <Spinner /> : playing ? <IconPause className="size-5" /> : <IconPlay className="size-6" />}
          </button>
          <button type="button" onClick={onNext} aria-label="다음 소식" className={nav}>
            <IconNext className="size-5" />
          </button>
          <div className="ml-1.5 min-w-0 flex-1">
            <SeekBar valueMs={posMs} totalMs={item.durationMs} onSeek={onSeek} label="이 소식 재생 위치" className="h-2.5" />
            <div className="flex justify-between text-[12px] font-extrabold tabular-nums text-sub">
              <span>{formatClock(posMs)}</span>
              <span>{formatClock(item.durationMs)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 체험 버튼: 로그인한 사람은 바로 요금제로, 아니면 로그인 뒤 요금제로 간다(AFTER_LOGIN_COOKIE, lib/server/sign-in.ts) */
function TrialButton({ offer, where, heard, total }: { offer: Offer; where: "list" | "finish"; heard: number; total: number }) {
  const signedIn = useSignedIn();
  return (
    <Link
      href={signedIn ? "/premium?trial=1" : "/login"}
      onClick={() => {
        if (!signedIn) setAfterLogin("trial");
        track("try_trial_click", { where, heard, items: total, signed_in: signedIn });
      }}
      className="btn min-h-14 w-full text-[17px] no-underline"
    >
      Premium {offer.trialDays}일 무료로 체험하기
    </Link>
  );
}

function FreeStart() {
  const signedIn = useSignedIn();
  if (signedIn) return null;
  return (
    <Link href="/login" onClick={() => setAfterLogin(null)} className="btn btn-ghost min-h-12 w-full text-[16px] no-underline">
      무료로 시작하기
    </Link>
  );
}

/** 목록 아래 Premium 권유 카드(요금제 화면 머리와 같은 남색) */
function PremiumOffer({ offer, where, heard, total, className = "" }: { offer: Offer; where: "list" | "finish"; heard: number; total: number; className?: string }) {
  return (
    <section aria-labelledby="try-premium-title" className={className}>
      <div className="relative overflow-hidden rounded-3xl bg-[#1F2340] px-6 pb-6 pt-6 text-white shadow-[0_6px_0_#11142A] dark:ring-2 dark:ring-line">
        <span aria-hidden="true" className="absolute -right-12 -top-14 size-48 rounded-full bg-white/[0.06]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-black tracking-[0.08em] text-mango">
            <Crown className="size-3.5" />
            PREMIUM
          </span>
          <h2 id="try-premium-title" className="mt-3 text-[24px] font-black leading-tight tracking-[-0.03em]">
            내 관심 분야 소식만,
            <br />
            {offer.trialDays}일 동안 무료로 들어 보세요
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {offer.perks.map((p) => (
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
          <div className="mt-6">
            <TrialButton offer={offer} where={where} heard={heard} total={total} />
          </div>
          <p className="mt-3 text-center text-[13px] font-semibold leading-relaxed text-white/70">
            체험이 끝나기 전에 해지하면 결제되지 않아요. 그 뒤에는 {offer.priceLabel}이에요.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <FreeStart />
      </div>
    </section>
  );
}

/** 마지막 소식까지 다 들었을 때 한 번 뜨는 팝업(가입 축하 팝업과 같은 모양). 바깥을 누르면 닫힌다 */
function FinishDialog({ offer, heard, total, onClose }: { offer: Offer; heard: number; total: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="try-finish-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(340px,calc(100vw-40px))] max-w-none overflow-visible bg-transparent p-0"
    >
      <div className="pop overflow-hidden rounded-[28px] bg-paper text-center text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        <div aria-hidden="true" className="keep-light relative h-[150px] bg-[#FFF4D6]">
          <Confetti />
          <Mascot mood="cheer" className="absolute left-1/2 top-5 size-[112px] -translate-x-1/2" />
        </div>
        <div className="px-6 pb-6 pt-5">
          <h2 id="try-finish-title" className="text-[20px] font-black leading-[1.45] tracking-[-0.03em]">
            소식 {heard}개를 들어 봤어요~!
          </h2>
          <p className="mt-1.5 text-[15px] font-semibold leading-relaxed text-sub">
            가입하면 내가 고른 분야 소식만
            <br />
            매일 골라서 읽어 드려요.
          </p>
          <div className="mt-5">
            <TrialButton offer={offer} where="finish" heard={heard} total={total} />
          </div>
          <p className="mt-2.5 text-[12px] font-semibold leading-relaxed text-sub">
            체험이 끝나기 전에 해지하면 결제되지 않아요. 그 뒤 {offer.priceLabel}.
          </p>
          <div className="mt-3">
            <FreeStart />
          </div>
        </div>
      </div>
    </dialog>
  );
}
