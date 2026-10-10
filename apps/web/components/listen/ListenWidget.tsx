"use client";

import { PERSONAS } from "@maengo/core/audio";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { minutesLabel, personaName } from "@/lib/player/labels";
import { formatClock } from "@/lib/player/machine";
import { Queue, Switch } from "./controls";

/**
 * 오른쪽 아래에 떠 있는 "오늘 맹고 전체 듣기". 챗봇 창처럼 누르면 듣기 창이 펼쳐진다.
 * 재생·멈춤은 펼치지 않고 버튼에서 바로 할 수 있다. 플레이어는 (app) 레이아웃에 있어 화면을 옮겨도 이어진다.
 */
export function ListenWidget() {
  const p = usePlayer();
  const { game } = useToday();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

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

  if (!game.total) return null;

  const ch = p.chapters[p.cur];
  const playing = p.status === "playing";
  const minutes = minutesLabel(p.personaTotalMs(p.persona));
  const sub = !p.enabled
    ? "플러스에서 들을 수 있어요"
    : p.error
      ? "음성을 만들지 못했어요"
      : p.preparing
        ? "음성 만드는 중 · 처음 한 번만 1~2분"
        : ch
      ? `${p.progress.count}개 중 ${p.progress.position}번째 ${playing ? "듣는 중" : "멈춤"}`
      : p.status === "done"
        ? "오늘 소식을 다 들었어요"
        : `${game.total}개, ${minutes}`;
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  return (
    <div className="pointer-events-none fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open && (
        <div
          id="listen-widget"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="listen-widget-title"
          className="rise tile pointer-events-auto flex max-h-[min(660px,calc(100dvh-170px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden shadow-[0_16px_48px_rgb(31_35_64/0.2)] outline-none"
        >
          <header className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
            <Mascot mood="listen" className={`size-10 shrink-0 ${playing ? "bob" : ""}`} />
            <div className="min-w-0 flex-1">
              <h2 id="listen-widget-title" className="text-[16px] font-black">
                오늘 맹고 전체 듣기
              </h2>
              <p className="truncate text-[12px] font-bold text-sub">
                {p.enabled ? `${game.total}개, ${personaName(p.persona)} 말투로 ${minutes}` : `오늘 ${game.total}개`}
              </p>
            </div>
            <button type="button" aria-label="듣기 창 접기" onClick={close} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-sub">
              <IconChevronDown className="size-6" />
            </button>
          </header>

          {p.enabled ? (
            <>
              <div className="px-4 pb-4 pt-3">
                <p className="line-clamp-2 min-h-[44px] text-[15px] font-extrabold leading-snug">
                  {ch?.title ?? (p.status === "done" ? "오늘 소식을 다 들었어요. 다시 들으려면 재생을 누르세요." : `한 번 누르면 ${game.total}개를 순서대로 끝까지 읽어 드려요.`)}
                </p>
                <ProgressBar value={p.progress.totalMs ? p.progress.elapsedMs / p.progress.totalMs : 0} tone="sky" label="오늘 브리핑 진행" className="mt-2 h-3" />
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
                <div role="group" aria-label="말투" className="mt-4 grid grid-cols-3 gap-1.5">
                  {PERSONAS.map((info) => {
                    const on = info.id === p.persona;
                    return (
                      <button
                        key={info.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => p.setPersona(info.id)}
                        className={`tile min-h-10 text-[13px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
                      >
                        {info.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border-t-2 border-line px-3 pb-3">
                <div className="px-1">
                  <Switch label="다음 소식 자동 재생" checked={p.autoNext} onChange={p.setAutoNext} />
                </div>
                <Queue />
              </div>
              <footer className="border-t-2 border-line px-4 py-3 text-center">
                <Link href="/listen" className="text-[14px] font-extrabold text-sky no-underline hover:underline">
                  대본 보며 듣기
                </Link>
              </footer>
            </>
          ) : (
            <div className="flex flex-col items-center px-5 pb-5 pt-4 text-center">
              <Mascot mood="listen" className="size-24" />
              <p className="mt-2 text-[16px] font-black">귀로 듣기는 플러스에서</p>
              <p className="mt-1 text-[14px] font-semibold leading-relaxed text-sub">
                하루 최대 10개를 받고, 선생님·아나운서·대담 말투로 끝까지 이어서 들어요.
              </p>
              <Link href="/settings#plan" className="btn mt-4 w-full">
                7일 무료로 들어 보기
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="tile pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)]">
        <button
          ref={launcherRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? "listen-widget" : undefined}
          aria-label={`오늘 맹고 전체 듣기 창 ${open ? "접기" : "열기"}`}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 text-left hover:bg-snow"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mango-tint">
            <Mascot mood="listen" className={`size-10 ${playing ? "bob" : ""}`} />
          </span>
          <span className="min-w-0 max-w-[190px]">
            <span className="block truncate text-[15px] font-black">{ch ? ch.title : "오늘 맹고 전체 듣기"}</span>
            <span className={`block truncate text-[12px] font-bold ${p.enabled ? "text-sky" : "text-mango-deep"}`}>{sub}</span>
          </span>
        </button>
        {p.enabled ? (
          <button
            type="button"
            onClick={p.toggle}
            disabled={!p.ready}
            aria-label={playing ? "일시정지" : "오늘 맹고 전체 듣기 재생"}
            className="btn btn-sky size-12 min-h-0 shrink-0 rounded-full p-0"
          >
            {playing ? <IconPause className="size-5" /> : <IconPlay className="size-6" />}
          </button>
        ) : (
          <span className="mr-1.5 shrink-0 rounded-md bg-mango px-1.5 py-0.5 text-[11px] font-black">PLUS</span>
        )}
      </div>
    </div>
  );
}
