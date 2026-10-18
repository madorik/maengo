"use client";

import Link from "next/link";
import { IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { SeekBar, SKIP_MS, SkipButton } from "@/components/listen/SeekBar";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { formatClock } from "@/lib/player/machine";


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

export function ListenBar({ ctl }: { ctl: ListenBarCtl }) {
  const playing = ctl.state === "playing";
  const retry = ctl.retry ?? ctl.play;

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
        <p role="status" className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-sky-dark">음성을 만드는 중이에요</span>
          <span className="block text-[13px] font-semibold text-sub">처음 듣는 소식은 1~2분 걸리고, 다 되면 바로 재생돼요</span>
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
            <p role="alert" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-orange">
              {ctl.error}
            </p>
            <button type="button" onClick={retry} className="btn btn-ghost min-h-10 shrink-0 px-3 text-[14px]">
              다시 시도
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {ctl.skip && <SkipButton dir={-1} onClick={() => ctl.skip?.(-SKIP_MS)} disabled={!canMove} className="size-10" />}
          <button
            type="button"
            aria-label={playing ? "일시정지" : "이어서 듣기"}
            onClick={playing ? ctl.pause : ctl.play}
            className="btn btn-sky size-14 min-h-0 shrink-0 rounded-full p-0"
          >
            {playing ? <IconPause className="size-6" /> : <IconPlay className="size-7" />}
          </button>
          {ctl.skip && <SkipButton dir={1} onClick={() => ctl.skip?.(SKIP_MS)} disabled={!canMove} className="size-10" />}
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
        <p className="min-w-0 flex-1 text-[16px] font-extrabold">이 글을 다 들었어요</p>
        {ctl.next ? (
          <button type="button" onClick={ctl.next} className="btn min-h-12 shrink-0 px-4 text-[15px]">
            다음 글 듣기
          </button>
        ) : (
          <button type="button" onClick={ctl.play} className="btn btn-ghost min-h-12 shrink-0 px-4 text-[15px]">
            다시 듣기
          </button>
        )}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        {ctl.error && (
          <p role="alert" className="w-full text-[13px] font-bold leading-relaxed text-orange">
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
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-paper">
        <div className="mx-auto max-w-[720px] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">{body}</div>
      </div>
    </>
  );
}
