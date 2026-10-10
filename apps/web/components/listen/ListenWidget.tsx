"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IconChevronDown, IconClose, IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { minutesLabel } from "@/lib/player/labels";
import { formatClock } from "@/lib/player/machine";
import { LISTEN_COLLAPSED_COOKIE } from "@/lib/ui-prefs";
import { Queue, Switch } from "./controls";

/**
 * 오른쪽 아래에 떠 있는 "오늘 맹고 전체 듣기". 챗봇 창처럼 누르면 듣기 창이 펼쳐진다.
 * 재생·멈춤은 펼치지 않고 버튼에서 바로 할 수 있다. 플레이어는 (app) 레이아웃에 있어 화면을 옮겨도 이어진다.
 * 보관함 플레이리스트를 듣는 동안은 "플레이리스트"로 바뀌고, 맨 아래 버튼으로 오늘 맹고 듣기로 돌아온다.
 * ✕로 작은 망고 버튼으로 접고, 그 버튼을 누르면 다시 편다. 접어 둔 상태는 쿠키에 두어 다음에 열어도 그대로다.
 */
export function ListenWidget({ initialCollapsed }: { initialCollapsed: boolean }) {
  const p = usePlayer();
  const profile = useProfile();
  const { game } = useToday();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);

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

  if (!game.total && !p.playlist) return null;

  const locked = !profile.audio;
  const playing = p.status === "playing";
  const heading = p.playlist ? "플레이리스트" : "오늘 맹고 전체 듣기";
  const total = p.playlist ? p.chapters.length || p.playlist.length : game.total;
  const doneText = p.playlist ? "플레이리스트를 다 들었어요" : "오늘 소식을 다 들었어요";

  // 접기·펴기. 쿠키는 서버 레이아웃이 읽어 첫 화면부터 맞게 그린다.
  // 키보드로 눌렀으면(click detail 0) 포커스를 바뀐 자리의 버튼으로 옮긴다. 터치·마우스는 옮기지 않는다(포커스 테두리가 남지 않게)
  const fold = (v: boolean, e: React.MouseEvent) => {
    document.cookie = `${LISTEN_COLLAPSED_COOKIE}=${v ? "1; max-age=31536000" : "; max-age=0"}; path=/; samesite=lax`;
    flushSync(() => {
      setOpen(false);
      setCollapsed(v);
    });
    if (e.detail === 0) (v ? bubbleRef.current : (launcherRef.current ?? foldRef.current))?.focus();
  };

  if (collapsed) {
    return (
      <div className="pointer-events-none fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-3 z-40 lg:bottom-6 lg:right-6">
        <button
          ref={bubbleRef}
          type="button"
          onClick={(e) => fold(false, e)}
          aria-label={`${heading} 펼치기${playing ? ", 듣는 중" : ""}`}
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
      aria-label="전체 듣기 접기"
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-faint hover:bg-snow hover:text-sub"
    >
      <IconClose className="size-5 [stroke-width:2.4]" />
    </button>
  );

  // Free: 전체 듣기 자리는 두고 막아 둔다. Premium 배지로 안내하고 창은 열지 않는다
  if (locked) {
    return (
      <div className="pointer-events-none fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-3 z-40 lg:bottom-6 lg:right-6">
        <div className="rise tile pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.12)]">
          <div aria-disabled="true" title="듣기는 Premium에서 쓸 수 있어요" className="flex min-w-0 cursor-not-allowed items-center gap-2.5 pr-1">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-snow">
              <Mascot mood="listen" className="size-10 opacity-60" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-black text-sub">오늘 맹고 전체 듣기</span>
              <span className="block truncate text-[12px] font-bold text-faint">Premium에서 들을 수 있어요</span>
            </span>
            <PremiumBadge />
          </div>
          {foldButton}
        </div>
      </div>
    );
  }

  const ch = p.chapters[p.cur];
  const minutes = minutesLabel(p.personaTotalMs(p.persona));
  const sub = p.error
      ? "음성을 만들지 못했어요"
      : p.preparing
        ? "음성 만드는 중 · 처음 한 번만 1~2분"
        : ch
      ? `${p.progress.count}개 중 ${p.progress.position}번째 ${playing ? "듣는 중" : "멈춤"}`
      : p.status === "done"
        ? doneText
        : `${total}개, ${minutes}`;
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  return (
    <div className="pointer-events-none fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
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
              <p className="truncate text-[12px] font-bold text-sub">
                {`${total}개, ${p.voice === "f" ? "여성" : "남성"} 목소리로 ${minutes}`}
              </p>
            </div>
            <button type="button" aria-label="듣기 창 접기" onClick={close} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-sub">
              <IconChevronDown className="size-6" />
            </button>
          </header>

            <>
            <div className="px-4 pb-4 pt-3">
              <p className="line-clamp-2 min-h-[44px] text-[15px] font-extrabold leading-snug">
                {ch?.title ?? (p.status === "done" ? `${doneText}. 다시 들으려면 재생을 누르세요.` : `한 번 누르면 ${total}개를 순서대로 끝까지 읽어 드려요.`)}
              </p>
              <ProgressBar value={p.progress.totalMs ? p.progress.elapsedMs / p.progress.totalMs : 0} tone="sky" label={`${heading} 진행`} className="mt-2 h-3" />
              <p className="mt-1.5 flex justify-between text-[12px] font-bold tabular-nums text-sub">
                <span>{ch ? `${p.progress.count}개 중 ${p.progress.position}번째` : `${p.progress.count}개`}</span>
                <span>
                  {formatClock(p.progress.elapsedMs)} / {formatClock(p.progress.totalMs)}
                </span>
              </p>
              {p.preparing && (
                <p role="status" className="mt-2 rounded-xl bg-sky-tint px-3 py-2 text-[13px] font-bold leading-relaxed text-sky-dark">
                  음성을 만드는 중이에요. 처음 듣는 소식은 1~2분 걸리고, 다 되면 바로 재생돼요.
                </p>
              )}
              {p.error && (
                <p role="alert" className="mt-2 text-[13px] font-bold leading-relaxed text-orange">
                  {p.error}
                </p>
              )}
              <div className="mt-2 flex items-center justify-center gap-5">
                <button type="button" aria-label="이전 소식" onClick={p.prev} disabled={!p.canPrev} className="btn btn-ghost size-12 min-h-0 rounded-full p-0">
                  <IconPrev />
                </button>
                <button
                  type="button"
                  aria-label={playing ? "일시정지" : "재생"}
                  onClick={p.toggle}
                  disabled={!p.ready}
                  className="btn btn-sky size-16 min-h-0 rounded-full p-0"
                >
                  {playing ? <IconPause className="size-6" /> : <IconPlay className="size-7" />}
                </button>
                <button type="button" aria-label="다음 소식" onClick={p.next} disabled={!p.canNext || !p.ready} className="btn btn-ghost size-12 min-h-0 rounded-full p-0">
                  <IconNext />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t-2 border-line px-3 pb-3">
              <div className="px-1">
                <Switch label="다음 소식 자동 재생" checked={p.autoNext} onChange={p.setAutoNext} />
              </div>
              <Queue />
            </div>
            <footer className="border-t-2 border-line px-4 py-3 text-center">
              {p.playlist ? (
                <button type="button" onClick={p.exitPlaylist} className="text-[14px] font-extrabold text-sky hover:underline">
                  오늘 맹고 듣기로 돌아가기
                </button>
              ) : (
                <Link href="/listen" className="text-[14px] font-extrabold text-sky no-underline hover:underline">
                  대본 보며 듣기
                </Link>
              )}
            </footer>
          </>
        </div>
      )}

      <div className="rise tile pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)]">
        <button
          ref={launcherRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? "listen-widget" : undefined}
          aria-label={`${heading} 창 ${open ? "접기" : "열기"}`}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 text-left hover:bg-snow"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mango-tint">
            <Mascot mood="listen" className={`size-10 ${playing ? "bob" : ""}`} />
          </span>
          <span className="min-w-0 max-w-[170px]">
            <span className="block truncate text-[15px] font-black">{ch ? ch.title : heading}</span>
            <span className="block truncate text-[12px] font-bold text-sky">{sub}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={p.toggle}
          disabled={!p.ready}
          aria-label={playing ? "일시정지" : `${heading} 재생`}
          className="btn btn-sky size-12 min-h-0 shrink-0 rounded-full p-0"
        >
          {playing ? <IconPause className="size-5" /> : <IconPlay className="size-6" />}
        </button>
        {foldButton}
      </div>
    </div>
  );
}
