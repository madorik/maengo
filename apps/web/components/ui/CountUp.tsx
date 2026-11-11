"use client";

import { useEffect, useRef, useState } from "react";

// 숫자가 0부터 올라가는 표시(2026-11-11 사용자: 오늘 화면의 '약 N분'·'언론 N곳'·'기사 N건' — "오, 많은 곳에서 골랐네" 하게).
// 처음 그릴 때(서버 HTML 포함)는 0이고, 화면에 붙으면 약 1초 동안 올라가다 끝에서 천천히 멈춘다.
// 앱을 연 뒤 같은 자리·같은 값은 한 번만 움직인다(다른 화면에 갔다 와도 다시 세지 않는다). 값이 바뀌면(예: 어림 시간 → 실제 음성 길이) 지금 숫자에서 새 값으로 간다.
// 화면 낭독기는 움직이는 숫자 대신 마지막 값을 읽는다. 움직임 줄이기를 켠 기기는 바로 마지막 값.
const played = new Set<string>();
const DURATION_MS = 1000;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ value, id, className = "" }: { value: number; /** 같은 숫자를 한 번만 움직이게 하는 이름(예: 'today-sources') */ id: string; className?: string }) {
  const key = `${id}:${value}`;
  const [shown, setShown] = useState(() => (played.has(key) ? value : 0));
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    // 이미 움직였거나 움직임 줄이기면 다음 그림에서 바로 마지막 값
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce || played.has(key) ? 0 : DURATION_MS;
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      // rAF 시각은 그 그림의 시작이라 effect에서 잰 시각보다 앞설 수 있다(음수가 되지 않게)
      const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      setShown(Math.round(from + (value - from) * ease(t)));
      if (t < 1) frame = requestAnimationFrame(step);
      // 끝까지 움직였을 때만 '움직임'으로 남긴다(중간에 화면을 떠났으면 다음에 다시, 개발 모드의 두 번 실행에도 첫 번은 지워진다)
      else played.add(key);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, value]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span aria-hidden="true">{shown.toLocaleString("ko-KR")}</span>
      <span className="sr-only">{value.toLocaleString("ko-KR")}</span>
    </span>
  );
}
