"use client";

import type { Persona } from "@maengo/core/types";
import Link from "next/link";
import { useState } from "react";
import { IconCap, IconChat, IconMic, IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { PersonaPicker, VoicePicker } from "@/components/listen/controls";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Sheet } from "@/components/ui/Sheet";
import { personaName } from "@/lib/player/labels";
import { formatClock } from "@/lib/player/machine";

const PERSONA_ICON: Record<Persona, typeof IconMic> = { announcer: IconMic, teacher: IconCap, dialogue: IconChat };

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
  /** 다 들은 뒤 "다음 글 듣기"(오늘 글만) */
  next?: () => void;
}

export function ListenBar({ ctl }: { ctl: ListenBarCtl }) {
  const p = usePlayer();
  const [sheet, setSheet] = useState(false);
  const PersonaIcon = PERSONA_ICON[p.persona];
  const playing = ctl.state === "playing";

  const personaButton = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`말투 바꾸기, 지금 ${personaName(p.persona)}`}
      onClick={() => setSheet(true)}
      className="btn btn-ghost min-h-12 shrink-0 px-3 text-[14px]"
    >
      <PersonaIcon className="size-5 text-sky" />
      <span className="hidden sm:inline">{personaName(p.persona)}</span>
    </button>
  );

  let body: React.ReactNode;
  if (ctl.state === "locked") {
    body = (
      <div className="flex items-center gap-3">
        <Mascot mood="listen" className="size-12 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">이 글 듣기는 Premium에서</span>
          <span className="block text-[13px] font-semibold text-sub">7일 무료 체험으로 들어 볼 수 있어요</span>
        </p>
        <Link href="/settings#plan" className="btn min-h-11 shrink-0 px-4 text-[14px]">
          체험하기
        </Link>
      </div>
    );
  } else if (ctl.preparing) {
    body = (
      <div className="flex items-center gap-3" role="status">
        <Mascot mood="listen" className="bob size-12 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-sky-dark">음성을 만드는 중이에요</span>
          <span className="block text-[13px] font-semibold text-sub">처음 듣는 소식은 1~2분 걸리고, 다 되면 바로 재생돼요</span>
        </p>
        {personaButton}
      </div>
    );
  } else if (ctl.state === "playing" || ctl.state === "paused") {
    body = (
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={playing ? "일시정지" : "이어서 듣기"}
          onClick={playing ? ctl.pause : ctl.play}
          className="btn btn-sky size-14 min-h-0 shrink-0 rounded-full p-0"
        >
          {playing ? <IconPause className="size-6" /> : <IconPlay className="size-7" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-[13px] font-extrabold">
            <span className="truncate text-sky">
              {playing && <span className="hidden sm:inline">{personaName(p.persona)} 말투로 </span>}
              {playing ? "듣는 중" : "멈춤"}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-sub">
              {formatClock(ctl.elapsedMs)} / {formatClock(ctl.totalMs)}
            </span>
          </div>
          <ProgressBar value={ctl.totalMs ? ctl.elapsedMs / ctl.totalMs : 0} tone="sky" label="이 글 듣기 진행" className="mt-1.5 h-3" />
        </div>
        <button
          type="button"
          onClick={ctl.cycleRate}
          aria-label={`재생 속도 ${ctl.rate}배, 눌러서 바꾸기`}
          className="tile min-h-11 min-w-12 shrink-0 px-2 font-round text-[14px] font-black text-sky-dark"
        >
          {ctl.rate.toFixed(1)}x
        </button>
        {personaButton}
      </div>
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
        <button type="button" onClick={ctl.play} disabled={!ctl.ready} className="btn btn-sky min-h-14 flex-1 text-[17px]">
          <IconSpeaker className="size-6" />이 글 듣기
          {ctl.totalMs > 0 && <span className="font-round text-[15px] font-extrabold opacity-85">{formatClock(ctl.totalMs)}</span>}
        </button>
        {personaButton}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-white">
        <div className="mx-auto max-w-[720px] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">{body}</div>
      </div>
      <Sheet title="말투와 목소리" open={sheet} onClose={() => setSheet(false)}>
        <PersonaPicker />
        <VoicePicker />
        <p className="mt-3 text-[13px] font-semibold text-sub">고르면 바로 저장돼요. 다음에 들을 때도 이 말투로 시작해요.</p>
      </Sheet>
    </>
  );
}
