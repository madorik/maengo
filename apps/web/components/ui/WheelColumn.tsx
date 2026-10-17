"use client";

import { useEffect, useRef, useState } from "react";

/** 줄 높이(px). 세 줄이 보이고 가운데 줄이 고른 값 */
export const WHEEL_ROW = 36;
/** 끝없이 도는 열은 목록을 이만큼 이어 붙인다. 멈췄을 때 양 끝 벌에 있으면 가운데 벌의 같은 자리로 몰래 옮긴다 */
const LOOPS = 7;

/**
 * 알람 시간처럼 위아래로 굴려 고르는 바퀴 한 열(2026-10-17). 브라우저 스크롤 스냅을 써서 관성·튕김은 기기 그대로다.
 * 멈추면(스크롤이 잠잠해지면) onChange(목록 칸 번호). 줄을 누르면 그 줄로, 위·아래 화살표 키로 한 칸씩
 */
export function WheelColumn({
  items,
  index,
  onChange,
  loop = false,
  label,
  className = "",
}: {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  loop?: boolean;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const n = items.length;
  const copies = loop ? LOOPS : 1;
  const mid = loop ? Math.floor(LOOPS / 2) * n : 0;
  // 화면 가운데 줄(이어 붙인 목록 기준). 굴리는 동안 가운데 글자를 진하게 보여 주는 데만 쓴다
  const [center, setCenter] = useState(mid + index);
  const settled = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  const settleRef = useRef<() => void>(() => {});

  // 처음 그릴 때와 바깥에서 값이 바뀔 때(저장이 막혀 되돌릴 때) 그 줄로 옮긴다
  useEffect(() => {
    const el = ref.current;
    if (!el || settled.current === index) return;
    settled.current = index;
    el.scrollTop = (mid + index) * WHEEL_ROW;
    setCenter(mid + index);
  }, [index, mid]);

  const settle = () => {
    const el = ref.current;
    if (!el) return;
    const raw = Math.round(el.scrollTop / WHEEL_ROW);
    const i = ((raw % n) + n) % n;
    const band = Math.floor(raw / n);
    if (loop && (band <= 0 || band >= copies - 1)) {
      el.scrollTop = (mid + i) * WHEEL_ROW;
      setCenter(mid + i);
    }
    if (i !== settled.current) {
      settled.current = i;
      onChangeRef.current(i);
    }
  };

  // 타이머·scrollend가 부르는 건 늘 마지막으로 그린 때의 settle·onChange
  useEffect(() => {
    onChangeRef.current = onChange;
    settleRef.current = settle;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollend를 아는 브라우저는 바로, 아니면 onScroll의 타이머가 잠잠해진 뒤에 정한다
    const onEnd = () => settleRef.current();
    el.addEventListener("scrollend", onEnd);
    return () => {
      el.removeEventListener("scrollend", onEnd);
      window.clearTimeout(timer.current);
    };
  }, []);

  const smooth = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const current = ((center % n) + n) % n;

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={items[current]}
      data-no-swipe
      onScroll={(e) => {
        const raw = Math.round(e.currentTarget.scrollTop / WHEEL_ROW);
        setCenter((c) => (c === raw ? c : raw));
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => settleRef.current(), 150);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        e.currentTarget.scrollBy({ top: e.key === "ArrowUp" ? -WHEEL_ROW : WHEEL_ROW, behavior: smooth() });
      }}
      className={`relative snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-xl [scrollbar-width:none] focus-visible:outline-offset-[-3px] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ height: WHEEL_ROW * 3, touchAction: "pan-y" }}
    >
      {/* 첫 줄·끝 줄도 가운데에 올 수 있게 위아래 한 줄씩 비운다 */}
      <div aria-hidden="true" style={{ height: WHEEL_ROW }} />
      {Array.from({ length: n * copies }, (_, k) => (
        <div
          key={k}
          aria-hidden="true"
          onClick={() => ref.current?.scrollTo({ top: k * WHEEL_ROW, behavior: smooth() })}
          className={`flex snap-center items-center justify-center transition-colors duration-150 select-none ${k === center ? "text-ink" : "text-faint/60"}`}
          style={{ height: WHEEL_ROW }}
        >
          {items[k % n]}
        </div>
      ))}
      <div aria-hidden="true" style={{ height: WHEEL_ROW }} />
    </div>
  );
}
