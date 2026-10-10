"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/components/providers/PlayerProvider";

/** 손으로 대본을 올리고 내린 뒤 이 시간 동안은 지금 줄로 끌고 오지 않는다 */
const HOLD_MS = 4000;

/**
 * 듣기 창의 '대본'(유튜브 뮤직 가사 보기처럼). 지금 소식의 대본을 줄마다 보여 주고, 읽는 줄을 진하게 해 가운데로 따라간다.
 * 줄을 누르면 그 줄부터 듣는다(재생을 시작한 뒤에만). 시작 전에는 첫 소식의 대본을 보여 준다.
 */
export function Script() {
  const p = usePlayer();
  const shown = Math.max(p.cur, 0);
  const ch = p.chapters[shown];
  const active = p.cur >= 0 ? p.lineIndex : -1;
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchedAt = useRef(0);

  // 소식이 바뀌면 맨 위로
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 0 });
  }, [shown]);

  // 읽는 줄을 가운데로(손으로 넘겨 보는 중이면 잠시 두었다가)
  useEffect(() => {
    const box = boxRef.current;
    const el = lineRefs.current[active];
    if (!box || !el || Date.now() - touchedAt.current < HOLD_MS) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  if (!ch) return null;
  const canSeek = p.cur >= 0 && p.status !== "done";
  const touch = () => {
    touchedAt.current = Date.now();
  };

  return (
    <div ref={boxRef} onWheel={touch} onTouchMove={touch} className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-4">
      {ch.lines.map((line, i) => {
        const now = i === active;
        const newPara = i > 0 && line.para !== undefined && line.para !== ch.lines[i - 1]!.para;
        return (
          <button
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            type="button"
            onClick={() => p.seek(line.startMs)}
            disabled={!canSeek}
            aria-current={now ? "true" : undefined}
            className={`block w-full rounded-lg py-1 text-left text-[18px] font-extrabold leading-snug transition-colors duration-300 enabled:hover:bg-snow ${newPara ? "mt-4" : ""} ${
              now ? "text-ink" : i < active ? "text-faint" : "text-sub"
            }`}
          >
            {line.text}
          </button>
        );
      })}
    </div>
  );
}
