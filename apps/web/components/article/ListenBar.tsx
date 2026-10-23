"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { SeekBar, SKIP_MS, SkipButton } from "@/components/listen/SeekBar";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { formatClock } from "@/lib/player/machine";

/** 막대 높이(px)를 담는 CSS 변수. 플레이어 위젯(ListenWidget)이 막대 바로 위에 뜨고, 글 화면 아래 여백(ArticleView)도 이 높이를 따른다 */
const BAR_HEIGHT_VAR = "--listen-bar-h";

/** 상세 화면 아래 "이 글 듣기" 막대가 쓰는 조작 묶음. 오늘 글과 지난 글이 같은 막대를 쓴다 */
export interface ListenBarCtl {
  state: "locked" | "idle" | "playing" | "paused" | "finished";
  ready: boolean;
  /** 음성을 만드는 중(처음 듣는 말투·소식) */
  preparing?: boolean;
  error?: string | null;
  elapsedMs: number;
  totalMs: number;
  play: () => void;
  pause: () => void;
  rate: number;
  cycleRate: () => void;
  /** 이 글 안의 한 시각(ms)으로 옮긴다(진행 막대) */
  seek?: (ms: number) => void;
  /** 앞뒤로 옮긴다(±15초) */
  skip?: (deltaMs: number) => void;
  /** 음성을 기다리는 중에 그만둔다 */
  cancel?: () => void;
  /** 오류 뒤 다시 시도 */
  retry?: () => void;
  /** 다 들은 뒤 "다음 글 듣기"(오늘 글만) */
  next?: () => void;
}

/** free: Free의 오늘 듣기 몫으로 듣는 글이라 '이 글 듣기' 옆에 '오늘 무료'를 붙인다 */
export function ListenBar({ ctl, free = false }: { ctl: ListenBarCtl; free?: boolean }) {
  const playing = ctl.state === "playing";
  const retry = ctl.retry ?? ctl.play;
  const barRef = useRef<HTMLDivElement>(null);

  // 막대 높이는 상태(오류·준비 중)와 안전 영역에 따라 바뀐다. 바뀔 때마다 CSS 변수로 남기고, 화면을 떠나면 지운다
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty(BAR_HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(BAR_HEIGHT_VAR);
    };
  }, []);

  let body: React.ReactNode;
  if (ctl.state === "locked") {
    // Free: 듣기 자리는 두고, 누르면 결제 페이지로
    body = (
      <Link
        href="/premium"
        aria-label="이 글 듣기, Premium에서 쓸 수 있어요"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-line bg-snow text-[17px] font-extrabold text-faint no-underline"
      >
        <IconSpeaker className="size-6" />
        이 글 듣기
        <PremiumBadge />
      </Link>
    );
  } else if (ctl.preparing) {
    body = (
      <div className="flex items-center gap-3">
        <Mascot mood="listen" className="bob size-12 shrink-0" />
        <p role="status" className="min-w-0 flex-1 text-[15px] font-extrabold text-sky-dark">
          음성 만드는 중
        </p>
        {ctl.cancel && (
          <button type="button" onClick={ctl.cancel} className="btn btn-ghost min-h-12 shrink-0 px-4 text-[15px]">
            취소
          </button>
        )}
      </div>
    );
  } else if (ctl.state === "playing" || ctl.state === "paused") {
    const canMove = ctl.totalMs > 0;
    body = (
      <>
        {ctl.error && (
          <div className="mb-2 flex items-center gap-2">
            <p role="alert" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-cherry">
              {ctl.error}
            </p>
            <button type="button" onClick={retry} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
              다시 시도
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {ctl.skip && <SkipButton dir={-1} onClick={() => ctl.skip?.(-SKIP_MS)} disabled={!canMove} className="size-11" />}
          <button
            type="button"
            aria-label={playing ? "일시정지" : "이어서 듣기"}
            onClick={playing ? ctl.pause : ctl.play}
            className="btn btn-sky size-14 min-h-0 shrink-0 rounded-full p-0"
          >
            {playing ? <IconPause className="size-6" /> : <IconPlay className="size-7" />}
          </button>
          {ctl.skip && <SkipButton dir={1} onClick={() => ctl.skip?.(SKIP_MS)} disabled={!canMove} className="size-11" />}
          {/* 좁은 화면에서도 버튼 줄 높이 안에 들어가게 막대 아래에 들은 시간·전체 시간을 둔다 */}
          <div className="ml-1.5 min-w-0 flex-1">
            <SeekBar
              valueMs={ctl.elapsedMs}
              totalMs={ctl.totalMs}
              onSeek={(ms) => ctl.seek?.(ms)}
              disabled={!ctl.seek}
              label="이 글 재생 위치"
              className="h-3"
            />
            <div className="flex justify-between text-[12px] font-extrabold tabular-nums text-sub">
              <span>{formatClock(ctl.elapsedMs)}</span>
              <span>{formatClock(ctl.totalMs)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={ctl.cycleRate}
            aria-label={`재생 속도 ${ctl.rate}배, 눌러서 바꾸기`}
            className="tile ml-1.5 min-h-11 min-w-12 shrink-0 px-2 font-round text-[14px] font-black tabular-nums text-sky-dark"
          >
            {ctl.rate.toFixed(1)}x
          </button>
        </div>
      </>
    );
  } else if (ctl.state === "finished") {
    body = (
      <div className="flex items-center gap-3">
        <Mascot mood="cheer" className="size-12 shrink-0" />
        {ctl.next ? (
          <button type="button" onClick={ctl.next} className="btn min-h-12 flex-1 px-4 text-[15px]">
            다음 글 듣기
          </button>
        ) : (
          <button type="button" onClick={ctl.play} className="btn btn-ghost min-h-12 flex-1 px-4 text-[15px]">
            다시 듣기
          </button>
        )}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        {ctl.error && (
          <p role="alert" className="w-full text-[13px] font-bold leading-relaxed text-cherry">
            {ctl.error}
          </p>
        )}
        {ctl.error ? (
          <button type="button" onClick={retry} disabled={!ctl.ready && !ctl.retry} className="btn btn-sky min-h-14 flex-1 text-[17px]">
            다시 시도
          </button>
        ) : (
          <button type="button" onClick={ctl.play} disabled={!ctl.ready} className="btn btn-sky min-h-14 flex-1 text-[17px]">
            <IconSpeaker className="size-6" />이 글 듣기
            {ctl.totalMs > 0 && <span className="font-round text-[15px] font-extrabold opacity-85">{formatClock(ctl.totalMs)}</span>}
            {free && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[12px] font-black">오늘 무료</span>}
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={barRef} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-paper">
      <div className="mx-auto max-w-[720px] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">{body}</div>
    </div>
  );
}
