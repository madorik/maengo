"use client";

import { useEffect, useState } from "react";

// 만드는 동안 보여 주는 진행 카드가 같이 쓰는 훅('오늘 소식 받기' MakeToday, '남은 소식 더 받기' FillToday)

/** 구간 [lo, hi] 안에서 천천히 차오르는 값(150ms마다 남은 거리의 pace만큼). 서버 알림이 없는 동안에도 멈춰 보이지 않게. 구간이 바뀌면 그 바닥부터 */
export function useCreep(lo: number, hi: number, pace: number): number {
  const [shown, setShown] = useState(lo);
  useEffect(() => {
    const id = setInterval(() => setShown((v) => Math.max(lo, v + (hi - Math.max(lo, v)) * pace)), 150);
    return () => clearInterval(id);
  }, [lo, hi, pace]);
  return Math.max(lo, shown);
}

/** ms마다 1씩 느는 수. 돌아가며 보여 줄 말을 고르는 데 쓴다 */
export function useTick(ms: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
