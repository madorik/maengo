"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { IconClose, IconList, IconMic, IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { Bubble } from "@/components/ui/Bubble";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { minutesLabel } from "@/lib/player/labels";
import { formatClock, startIndex } from "@/lib/player/machine";
import { Queue, Switch, VoicePicker } from "./controls";
import { PlusLock } from "./PlusLock";


/** 듣기 화면. 망고가 헤드폰을 쓰고, 지금 읽는 문장이 말풍선으로 쌓인다 */
export function ListenScreen() {
  const p = usePlayer();
  const { data, read, game } = useToday();
  const [sheet, setSheet] = useState<"voice" | "queue" | null>(null);

  const playing = p.status === "playing";
  const active = p.cur >= 0;
  const shown = active ? p.cur : startIndex(p.chapters, read, p.skipRead);
  const ch = p.chapters[shown];

  const header = (
    <header className="mx-auto flex w-full max-w-[760px] items-center gap-4 px-4 pb-2 pt-[max(16px,env(safe-area-inset-top))]">
      <Link href="/today" aria-label="듣기 화면 닫고 오늘 목록으로" className="flex size-11 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-sub">
        <IconClose className="size-7 [stroke-width:2.6]" />
      </Link>
      <ProgressBar value={p.progress.totalMs ? p.progress.elapsedMs / p.progress.totalMs : 0} tone="sky" label="오늘 브리핑 진행" className="h-4 flex-1" />
      {p.enabled && (
        <button
          type="button"
          onClick={p.cycleRate}
          aria-label={`재생 속도 ${p.rate}배, 눌러서 바꾸기`}
          className="tile min-h-10 min-w-14 px-2 font-round text-[15px] font-black text-sky-dark"
        >
          {p.rate.toFixed(1)}x
        </button>
      )}
    </header>
  );

  if (!p.enabled) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        {header}
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <PlusLock />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white">
      {header}

      <main className="mx-auto flex min-h-0 w-full max-w-[640px] flex-1 flex-col px-5">
        {p.status === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Mascot mood="cheer" className="pop size-32" />
            <h1 className="mt-4 text-[26px] font-black text-mango-deep">{game.allDone ? "오늘 완료!" : "다 들었어요!"}</h1>
            <p className="mt-3 text-[16px] font-semibold leading-relaxed text-sub">
              {game.allDone ? `오늘은 여기까지예요. 내일 ${data.notifyLabel}에 새로 고른 소식으로 만나요.` : "건너뛴 소식은 오늘 목록에 남아 있어요."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={p.restart} className="btn btn-ghost">
                처음부터 다시 듣기
              </button>
              <Link href="/today" className="btn">
                오늘 목록으로
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="pt-3">
              <p className="text-[14px] font-black text-sky">
                {active ? `${p.progress.count}개 중 ${p.progress.position}번째` : `오늘 ${p.progress.count}개`}
                <span className="ml-2 font-bold tabular-nums text-sub">
                  {formatClock(p.progress.elapsedMs)} / {formatClock(p.progress.totalMs)}
                </span>
              </p>
              <h1 className="mt-1 line-clamp-2 text-[22px] font-black leading-snug tracking-[-0.02em]">{ch?.title ?? "오늘 브리핑을 준비하고 있어요"}</h1>
            </div>
            <Script
              lines={active ? (ch?.lines ?? []) : []}
              current={active ? p.lineIndex : -1}
              playing={playing}
              intro={`재생을 누르면 오늘 ${data.items.length}개를 끝까지 들려 드려요. ${minutesLabel(p.personaTotalMs(p.persona))}이에요.`}
            />
          </>
        )}
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto max-w-[640px] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          {p.error && (
            <p role="alert" className="pb-3 text-center text-[14px] font-bold text-orange">
              {p.error}
            </p>
          )}
          {p.preparing && (
            <p role="status" className="pb-3 text-center text-[14px] font-bold text-sky-dark">
              음성을 만드는 중이에요. 처음 듣는 소식은 1~2분 걸리고, 다 되면 바로 재생돼요.
            </p>
          )}
          <div className="flex items-center justify-center gap-6">
            <button type="button" aria-label="이전 소식" onClick={p.prev} disabled={!p.canPrev} className="btn btn-ghost size-14 min-h-0 rounded-full p-0">
              <IconPrev className="size-6" />
            </button>
            <button
              type="button"
              aria-label={playing ? "일시정지" : "재생"}
              onClick={p.toggle}
              disabled={!p.ready}
              className="btn btn-sky size-20 min-h-0 rounded-full p-0"
            >
              {playing ? <IconPause className="size-8" /> : <IconPlay className="size-9" />}
            </button>
            <button type="button" aria-label="다음 소식" onClick={p.next} disabled={!p.canNext || !p.ready} className="btn btn-ghost size-14 min-h-0 rounded-full p-0">
              <IconNext className="size-6" />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" aria-haspopup="dialog" onClick={() => setSheet("voice")} className="btn btn-ghost min-h-12 px-3 text-[15px]">
              <IconMic className="size-5 text-sky" />
              {p.voice === "f" ? "여성 목소리" : "남성 목소리"}
            </button>
            <button type="button" aria-haspopup="dialog" onClick={() => setSheet("queue")} className="btn btn-ghost min-h-12 px-3 text-[15px]">
              <IconList className="size-5 text-sky" />
              목록과 설정
            </button>
          </div>
        </div>
      </footer>

      <Sheet title="목소리" open={sheet === "voice"} onClose={() => setSheet(null)}>
        <VoicePicker />
        <p className="mt-3 text-[13px] font-semibold text-sub">고르면 바로 저장돼요. 다음에 들을 때도 이 목소리로 시작해요.</p>
      </Sheet>
      <Sheet title="재생 목록" open={sheet === "queue"} onClose={() => setSheet(null)}>
        <Switch label="다음 소식 자동 재생" note={p.autoNext ? "한 번 누르면 끝까지 이어서 들어요" : "소식 하나가 끝나면 멈춰요"} checked={p.autoNext} onChange={p.setAutoNext} />
        <Switch label="읽은 소식은 건너뛰기" checked={p.skipRead} onChange={p.setSkipRead} />
        <Queue onPick={() => setSheet(null)} />
      </Sheet>
    </div>
  );
}

/** 지금까지 읽은 문장을 말풍선으로 쌓는다. 대담이면 진행자는 왼쪽, 해설자는 오른쪽 */
function Script({ lines, current, playing, intro }: { lines: { who?: string; text: string }[]; current: number; playing: boolean; intro: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [current]);

  if (current < 0 && !lines.length) {
    return (
      <section aria-label="듣기 안내" className="flex min-h-0 flex-1 flex-col items-center justify-center pb-6 text-center">
        <Bubble tail="bottom" className="max-w-[360px]">
          <p className="text-[16px] font-bold leading-relaxed">{intro}</p>
        </Bubble>
        <Mascot mood="listen" className="mt-4 size-36" />
      </section>
    );
  }

  const shown = lines.slice(0, Math.max(0, current + 1));
  return (
    <section aria-label="지금 읽는 대본" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-5">
      {shown.map((line, i) => {
        const right = line.who === "해설자";
        const isCurrent = i === current;
        const firstOfRun = i === 0 || shown[i - 1]!.who !== line.who;
        return (
          <div key={i} className={`flex items-end gap-2 ${right ? "flex-row-reverse" : ""}`}>
            <span className="w-12 shrink-0">
              {firstOfRun && (
                <Mascot mood={right ? "happy" : "listen"} className={`size-12 ${right ? "-scale-x-100" : ""} ${isCurrent && playing ? "bob" : ""}`} />
              )}
            </span>
            <div className={`max-w-[80%] ${right ? "items-end" : ""} flex flex-col`}>
              {line.who && firstOfRun && <span className="mb-1 px-1 text-[12px] font-extrabold text-sub">{line.who}</span>}
              <div
                className={`rounded-2xl border-2 px-4 py-2.5 text-[17px] leading-[1.6] ${
                  isCurrent ? "border-sky bg-sky-tint font-bold text-ink" : "border-line bg-white font-medium text-sub"
                }`}
              >
                {line.text}
              </div>
            </div>
          </div>
        );
      })}
      {current < 0 && (
        <div className="flex items-end gap-2">
          <Mascot mood="listen" className={`size-12 shrink-0 ${playing ? "bob" : ""}`} />
          <div className="rounded-2xl border-2 border-line px-4 py-2.5 text-[17px] font-black tracking-[0.2em] text-faint" aria-label="곧 읽어요">
            ···
          </div>
        </div>
      )}
      <div ref={endRef} />
    </section>
  );
}
