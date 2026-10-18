"use client";

import { useRef, useState } from "react";
import { IconBack15, IconForward15 } from "@/components/icons";
import { formatClock } from "@/lib/player/machine";

/** 키보드로 옮기는 폭: 좌우·위아래 화살표 5초, Page Up·Down 30초 */
const STEP_MS = 5000;
const PAGE_MS = 30000;
/** ±15초 버튼 */
export const SKIP_MS = 15000;

/**
 * 누르거나 끌어서 옮기는 재생 막대(ProgressBar와 같은 모양). 끄는 동안은 손가락 자리를 보여 주고 놓을 때 옮긴다.
 * 키보드: 화살표 5초, Page Up·Down 30초, Home·End 처음·끝. 오늘 브리핑 플레이어와 글 하나 듣기가 같이 쓴다
 */
export function SeekBar({
  valueMs,
  totalMs,
  onSeek,
  label,
  disabled = false,
  className = "h-3",
}: {
  valueMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
  label: string;
  disabled?: boolean;
  /** 막대 높이 등(바깥 여백은 누르기 쉽게 따로 둔다) */
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const off = disabled || totalMs <= 0;
  const shown = Math.min(totalMs, Math.max(0, drag ?? valueMs));
  const pct = totalMs > 0 ? (shown / totalMs) * 100 : 0;

  const at = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return shown;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * totalMs;
  };
  const commit = (ms: number) => onSeek(Math.round(Math.min(totalMs, Math.max(0, ms))));

  return (
    <div
      role="slider"
      tabIndex={off ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs / 1000)}
      aria-valuenow={Math.round(shown / 1000)}
      aria-valuetext={`${formatClock(shown)} / ${formatClock(totalMs)}`}
      aria-disabled={off || undefined}
      onPointerDown={(e) => {
        if (off || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(at(e.clientX));
      }}
      onPointerMove={(e) => {
        if (drag !== null) setDrag(at(e.clientX));
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        setDrag(null);
        commit(at(e.clientX));
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        if (off) return;
        const step: Record<string, number> = { ArrowLeft: -STEP_MS, ArrowDown: -STEP_MS, ArrowRight: STEP_MS, ArrowUp: STEP_MS, PageDown: -PAGE_MS, PageUp: PAGE_MS };
        const ms = e.key in step ? valueMs + step[e.key]! : e.key === "Home" ? 0 : e.key === "End" ? totalMs : null;
        if (ms === null) return;
        e.preventDefault();
        commit(ms);
      }}
      // 끄는 동안 화면이 같이 스크롤되지 않게 touch-none. 위아래 여백은 손가락으로 누르기 쉽게
      className={`relative flex touch-none select-none items-center rounded-full py-2 ${off ? "" : "cursor-pointer"}`}
    >
      <div ref={trackRef} className={`relative w-full rounded-full bg-line ${className}`}>
        <div
          className={`relative h-full rounded-full bg-sky ${drag === null ? "transition-[width] duration-300 ease-out" : ""}`}
          style={{ width: `${pct}%` }}
        >
          {pct > 4 && <span className="absolute inset-x-2 top-[22%] h-[22%] min-h-[3px] rounded-full bg-white/40" />}
        </div>
        {!off && (
          <span
            aria-hidden
            className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper bg-sky shadow-[0_1px_4px_rgb(31_35_64/0.3)] ${drag === null ? "transition-[left] duration-300 ease-out" : "scale-125"}`}
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** 15초 뒤로·앞으로 */
export function SkipButton({ dir, onClick, disabled = false, className = "size-12" }: { dir: -1 | 1; onClick: () => void; disabled?: boolean; className?: string }) {
  const Icon = dir < 0 ? IconBack15 : IconForward15;
  return (
    <button
      type="button"
      aria-label={dir < 0 ? "15초 뒤로" : "15초 앞으로"}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center rounded-full text-sub enabled:hover:bg-snow enabled:hover:text-ink disabled:opacity-40 ${className}`}
    >
      <Icon className="size-7" />
    </button>
  );
}
