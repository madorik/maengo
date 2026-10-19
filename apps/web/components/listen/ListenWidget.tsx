"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { flushSync } from "react-dom";
import { IconChevronDown, IconClose, IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { Sheet } from "@/components/ui/Sheet";
import { minutesLabel } from "@/lib/player/labels";
import { formatClock } from "@/lib/player/machine";
import { LISTEN_COLLAPSED_COOKIE } from "@/lib/ui-prefs";
import { Queue, Switch } from "./controls";
import { Script } from "./Script";
import { SeekBar, SKIP_MS, SkipButton } from "./SeekBar";

/**
 * 오른쪽 아래에 떠 있는 "오늘 소식 전체 듣기". 챗봇 창처럼 누르면 플레이어(듣기 창)가 펼쳐진다.
 * 재생·멈춤은 펼치지 않고 버튼에서 바로 할 수 있다. 플레이어는 (app) 레이아웃에 있어 화면을 옮겨도 이어진다.
 * 플레이리스트를 듣는 동안은 "플레이리스트"로 바뀌고, 맨 아래 버튼으로 오늘 소식 듣기로 돌아온다.
 * ✕로 작은 망고 버튼으로 접고, 그 버튼을 누르면 다시 편다. 접어 둔 상태는 쿠키에 두어 다음에 열어도 그대로다.
 * 글 화면은 아래 '이 글 듣기' 막대가 있어서, 플레이어가 돌고 있지 않으면 작은 망고 버튼으로만 둔다(누르면 그 글에서는 편다).
 * 앱(inApp)에서는 창 대신 화면을 꽉 채우는 시트(components/ui/Sheet.tsx full)로 연다(2026-10-19 사용자 결정): 끌어 내리기·안드로이드 뒤로 가기로 닫힌다.
 */
export function ListenWidget({ initialCollapsed, inApp = false }: { initialCollapsed: boolean; /** 앱(Capacitor)인지. 서버가 User-Agent로 정한다 */ inApp?: boolean }) {
  const p = usePlayer();
  const profile = useProfile();
  const { game } = useToday();
  const [open, setOpen] = useState(false);
  /** 창 아래쪽: 재생 목록 또는 대본(유튜브 뮤직 가사 보기처럼) */
  const [tab, setTab] = useState<"queue" | "script">("queue");
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  /** 글 화면에서 망고 버튼을 눌러 편 화면 주소(그 글에서만 펴 둔다) */
  const [peek, setPeek] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  // 로그인한 화면 어디서나 뜬다((app) 레이아웃). 전체 화면 듣기(/listen)에서는 숨긴다.
  // 글 화면은 아래 '이 글 듣기' 막대 바로 위로. 막대 높이는 상태(오류·준비 중)와 안전 영역에 따라 달라서 막대가 남긴 값(--listen-bar-h)을 쓴다
  const pathname = usePathname();
  const onArticle = pathname.startsWith("/article");
  const dock = onArticle
    ? "bottom-[calc(var(--listen-bar-h,104px)+12px)]"
    : "bottom-[calc(16px+env(safe-area-inset-bottom))] lg:bottom-6";

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.startsWith("/listen") || (!game.total && !p.playlist)) return null;

  const locked = !profile.audio;
  const playing = p.status === "playing";
  // 글 화면에서는 플레이어가 돌고 있을 때(재생·멈춤·음성 기다림)만 펴 둔다. 그 밖에는 막대와 겹치지 않게 망고 버튼으로
  const live = playing || p.status === "paused" || p.preparing;
  const folded = collapsed || (onArticle && !live && peek !== pathname);
  // 접혀 있는 동안 창은 닫아 둔다(글 화면에서 플레이어가 돌기 시작해 펴질 때 창이 갑자기 열리지 않게)
  if (folded && open) setOpen(false);
  // 이름은 늘 "플레이어". 무엇을 듣는지(플레이리스트·오늘 소식)는 소제목에 쓴다
  const heading = "플레이어";
  const source = p.playlist ? "플레이리스트" : "오늘 소식";
  const total = p.playlist ? p.chapters.length || p.playlist.length : game.total;
  const doneText = p.playlist ? "플레이리스트를 다 들었어요" : "오늘 소식을 다 들었어요";

  // 접기·펴기. 쿠키는 서버 레이아웃이 읽어 첫 화면부터 맞게 그린다.
  // 키보드로 눌렀으면(click detail 0) 포커스를 바뀐 자리의 버튼으로 옮긴다. 터치·마우스는 옮기지 않는다(포커스 테두리가 남지 않게)
  const fold = (v: boolean, e: React.MouseEvent) => {
    document.cookie = `${LISTEN_COLLAPSED_COOKIE}=${v ? "1; max-age=31536000" : "; max-age=0"}; path=/; samesite=lax`;
    flushSync(() => {
      setOpen(false);
      setCollapsed(v);
      // 글 화면에서 펴면 그 글에서는 편 채로 둔다
      setPeek(v ? null : pathname);
    });
    if (e.detail === 0) (v ? bubbleRef.current : (launcherRef.current ?? foldRef.current))?.focus();
  };

  if (folded) {
    return (
      <div className={`pointer-events-none fixed right-3 z-40 lg:right-6 ${dock}`}>
        <button
          ref={bubbleRef}
          type="button"
          onClick={(e) => fold(false, e)}
          aria-label={`플레이어 펼치기${playing ? ", 듣는 중" : ""}`}
          className={`pop tile pointer-events-auto flex rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)] hover:bg-snow ${playing ? "border-sky" : ""}`}
        >
          <span className={`flex size-12 items-center justify-center rounded-full ${locked ? "bg-snow" : "bg-mango-tint"}`}>
            <Mascot mood="listen" className={`size-10 ${locked ? "opacity-60" : ""} ${playing ? "bob" : ""}`} />
          </span>
        </button>
      </div>
    );
  }

  const foldButton = (
    <button
      ref={foldRef}
      type="button"
      onClick={(e) => fold(true, e)}
      aria-label="플레이어 접기"
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-faint hover:bg-snow hover:text-sub"
    >
      <IconClose className="size-5 [stroke-width:2.4]" />
    </button>
  );

  // Free: 전체 듣기 자리는 두고, 누르면 결제 페이지로(창은 열지 않는다)
  if (locked) {
    return (
      <div className={`pointer-events-none fixed right-3 z-40 lg:right-6 ${dock}`}>
        <div className="rise tile pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.12)]">
          <Link href="/premium" aria-label="오늘 소식 전체 듣기, Premium에서 들을 수 있어요" className="flex min-w-0 items-center gap-2.5 pr-1 no-underline">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-snow">
              <Mascot mood="listen" className="size-10 opacity-60" />
            </span>
            <span className="min-w-0 truncate text-[15px] font-black text-sub">오늘 소식 전체 듣기</span>
            <PremiumBadge />
          </Link>
          {foldButton}
        </div>
      </div>
    );
  }

  const ch = p.chapters[p.cur];
  // 재생을 누르면 먼저 나올 소식(듣던 자리 이어 듣기·읽은 소식 건너뛰기 반영)
  const first = p.chapters[p.firstIndex];
  // 개수·시간은 재생 목록(챕터)에 든 소식으로 센다. 시간은 만든 음성이면 실제 길이, 아니면 대본 길이 어림값. 건너뛸 소식은 뺀다
  const count = p.ready ? p.progress.count : total;
  const minutes = p.ready ? minutesLabel(p.progress.totalMs) : "";
  const voiceName = p.voice === "f" ? "여성" : "남성";
  const sub = p.error
      ? p.error
      : p.preparing
        ? "음성 만드는 중"
        : ch
      ? (playing ? "듣는 중" : "멈춤")
      : p.status === "done"
        ? doneText
        : `${source} ${count}개${minutes && `, ${minutes}`}`;
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };
  // 에피소드 정보를 못 받았으면 재생 버튼이 다시 받기를 한다(막혀 있지 않게)
  const canPlay = p.ready || !!p.error;
  const playAction = p.ready ? p.toggle : p.retry;

  // 앱의 꽉 찬 시트에서는 버튼을 조금 키운다(듣기 화면과 같은 크기)
  const big = inApp;
  const summary = `${source} ${count}개${minutes && `, ${voiceName} 목소리로 ${minutes}`}`;

  const controls = (
    <div className={big ? "px-5 pb-5 pt-2" : "px-4 pb-4 pt-3"}>
      <p className={`line-clamp-2 font-extrabold leading-snug ${big ? "min-h-[56px] text-[20px]" : "min-h-[44px] text-[15px]"}`}>
        {ch?.title ?? (p.status === "done" ? doneText : first?.title)}
      </p>
      <SeekBar
        valueMs={p.progress.elapsedMs}
        totalMs={p.progress.totalMs}
        onSeek={p.seekProgress}
        disabled={!p.canSeek}
        label="재생 위치"
        className={big ? "mt-2 h-4" : "mt-0.5 h-3"}
      />
      <p className="text-right text-[12px] font-bold tabular-nums text-sub">
        {formatClock(p.progress.elapsedMs)} / {formatClock(p.progress.totalMs)}
      </p>
      {p.preparing && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-sky-tint py-2 pl-3 pr-2">
          <p role="status" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-sky-dark">
            음성 만드는 중
          </p>
          <button type="button" onClick={p.cancel} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
            취소
          </button>
        </div>
      )}
      {p.error && (
        <div className="mt-2 flex items-center gap-2">
          <p role="alert" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-cherry">
            {p.error}
          </p>
          <button type="button" onClick={p.retry} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
            다시 시도
          </button>
        </div>
      )}
      {/* 좁은 폰(360px 아래)에서도 한 줄에 동그랗게 들어가게 버튼과 간격을 조금 줄인다 */}
      <div className={`flex items-center justify-center gap-1 min-[360px]:gap-2 ${big ? "mt-4" : "mt-2"}`}>
        <button type="button" aria-label="이전 소식" onClick={p.prev} disabled={!p.canPrev} className="btn btn-ghost size-11 min-h-0 shrink-0 rounded-full p-0 min-[360px]:size-12">
          <IconPrev />
        </button>
        <SkipButton dir={-1} onClick={() => p.skipBy(-SKIP_MS)} disabled={!p.canSeek} className="size-11 min-[360px]:size-12" />
        <button
          type="button"
          aria-label={playing ? "일시정지" : p.ready ? "재생" : "다시 시도"}
          onClick={playAction}
          disabled={!canPlay}
          className={`btn btn-sky mx-1 min-h-0 shrink-0 rounded-full p-0 ${big ? "size-16 min-[360px]:size-20" : "size-14 min-[360px]:size-16"}`}
        >
          {playing ? <IconPause className={big ? "size-8" : "size-6"} /> : <IconPlay className={big ? "size-9" : "size-7"} />}
        </button>
        <SkipButton dir={1} onClick={() => p.skipBy(SKIP_MS)} disabled={!p.canSeek} className="size-11 min-[360px]:size-12" />
        <button type="button" aria-label="다음 소식" onClick={p.next} disabled={!p.canNext || !p.ready} className="btn btn-ghost size-11 min-h-0 shrink-0 rounded-full p-0 min-[360px]:size-12">
          <IconNext />
        </button>
      </div>
    </div>
  );

  const tabs = (
    <div role="tablist" aria-label="플레이어 보기" className="flex gap-5 border-y-2 border-line px-5">
      {(
        [
          ["queue", "재생 목록"],
          ["script", "대본"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`listen-tab-${id}`}
          aria-selected={tab === id}
          aria-controls="listen-tab-panel"
          onClick={() => {
            setTab(id);
            if (id === "script") track("script_tab_open", { mode: p.playlist ? "playlist" : "today" });
          }}
          className={`-mb-0.5 border-b-[3px] py-2.5 text-[14px] font-extrabold ${tab === id ? "border-sky text-ink" : "border-transparent text-faint hover:text-sub"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // 재생 목록·대본은 안에서 스크롤한다. data-no-sheet-drag: 앱의 꽉 찬 시트에서 목록을 내려도 시트가 내려오지 않게
  const tabPanel = (
    <div id="listen-tab-panel" role="tabpanel" aria-labelledby={`listen-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
      {tab === "script" ? (
        <Script />
      ) : (
        <div data-no-sheet-drag className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          <div className="px-1">
            <Switch label="다음 소식 자동 재생" checked={p.autoNext} onChange={p.setAutoNext} />
          </div>
          <Queue />
        </div>
      )}
    </div>
  );

  const footer = (
    <footer className={`border-t-2 border-line px-4 text-center ${big ? "pb-[max(12px,env(safe-area-inset-bottom))] pt-3" : "py-3"}`}>
      {p.playlist ? (
        <button type="button" onClick={p.exitPlaylist} className="text-[14px] font-extrabold text-sky hover:underline">
          오늘 소식 듣기로 돌아가기
        </button>
      ) : (
        <Link href="/listen" className="text-[14px] font-extrabold text-sky no-underline hover:underline">
          대본 보며 듣기
        </Link>
      )}
    </footer>
  );

  const launcher = (
    <div className="rise tile pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)]">
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-haspopup={inApp ? "dialog" : undefined}
        aria-controls={open && !inApp ? "listen-widget" : undefined}
        aria-label={`플레이어 창 ${open ? "닫기" : "열기"}`}
        onClick={() => setOpen(!open)}
        className="flex min-w-0 items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 text-left hover:bg-snow"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mango-tint">
          <Mascot mood="listen" className={`size-10 ${playing ? "bob" : ""}`} />
        </span>
        <span className="min-w-0 max-w-[170px]">
          <span className="block truncate text-[15px] font-black">{ch ? ch.title : heading}</span>
          <span className={`block truncate text-[12px] font-bold ${p.error ? "text-cherry" : "text-sky"}`}>{sub}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={playAction}
        disabled={!canPlay}
        aria-label={playing ? "일시정지" : p.ready ? `${heading} 재생` : "다시 시도"}
        className="btn btn-sky size-12 min-h-0 shrink-0 rounded-full p-0"
      >
        {playing ? <IconPause className="size-5" /> : <IconPlay className="size-6" />}
      </button>
      {foldButton}
    </div>
  );

  // 앱: 화면을 꽉 채우는 시트. 끌어 내리기·✕·안드로이드 뒤로 가기로 닫히고, 다 내려간 뒤 onClose가 open을 끈다
  if (inApp) {
    return (
      <>
        <Sheet title={heading} full open={open} onClose={close}>
          <div className="flex items-center gap-3 px-5 pb-1">
            <Mascot mood="listen" className={`size-12 shrink-0 ${playing ? "bob" : ""}`} />
            <p className="min-w-0 truncate text-[13px] font-bold text-sub">{summary}</p>
          </div>
          {controls}
          {tabs}
          {tabPanel}
          {footer}
        </Sheet>
        <div className={`pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-3 lg:right-6 ${dock}`}>{launcher}</div>
      </>
    );
  }

  return (
    <div className={`pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-3 lg:right-6 ${dock}`}>
      {open && (
        <div
          id="listen-widget"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="listen-widget-title"
          className="rise tile pointer-events-auto flex max-h-[min(660px,calc(100dvh-160px-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden shadow-[0_16px_48px_rgb(31_35_64/0.2)] outline-none"
        >
          <header className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
            <Mascot mood="listen" className={`size-10 shrink-0 ${playing ? "bob" : ""}`} />
            <div className="min-w-0 flex-1">
              <h2 id="listen-widget-title" className="text-[16px] font-black">
                {heading}
              </h2>
              <p className="truncate text-[12px] font-bold text-sub">{summary}</p>
            </div>
            <button type="button" aria-label="플레이어 창 닫기" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-sub">
              <IconChevronDown className="size-6" />
            </button>
          </header>
          {controls}
          {tabs}
          {tabPanel}
          {footer}
        </div>
      )}
      {launcher}
    </div>
  );
}
