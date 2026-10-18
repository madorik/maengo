"use client";

import { useEffect, useState, type RefObject } from "react";

/** '하나 더 받기'로 막 붙은 소식. count = 새로 붙은 소식 수, focus = 키보드(화면 읽기 도구)로 눌렀으면 새 소식 제목으로 초점을 옮긴다 */
export interface Arrival {
  id: number;
  count: number;
  focus: boolean;
}

interface Want {
  /** 누르기 직전 목록 */
  before: number[];
  focus: boolean;
  /** 받았다는 답이 왔는지 */
  settled: boolean;
}

/** 받았다는 답이 온 뒤 이만큼 안에 목록이 늘지 않으면 잊는다(뒤늦은 다른 새로 그리기에서 짚지 않게) */
const FORGET_MS = 10_000;

/**
 * '하나 더 받기'를 누른 뒤 목록에 새로 붙은 소식을 한 번만 짚는다.
 * 누르기 직전 목록을 기억해 두고(expect), 액션이 화면을 새로 그려 목록이 늘면 새 소식을 arrival로 넘긴다.
 * 첫 화면·다른 새로 그리기(플랜 전환 등)는 기억이 없어 짚지 않는다
 */
export function useMoreArrival(ids: number[]) {
  const [want, setWant] = useState<Want | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);

  // 목록이 늘어난 렌더에서 바로 정한다. 날짜가 바뀌어 목록이 통째로 바뀐 경우는 짚지 않는다(누르기 전 소식이 다 남아 있어야)
  if (want) {
    const added = ids.filter((id) => !want.before.includes(id));
    if (added.length > 0) {
      setWant(null);
      if (want.before.every((id) => ids.includes(id))) setArrival({ id: added[0]!, count: added.length, focus: want.focus });
    }
  }

  useEffect(() => {
    if (!want?.settled) return;
    const t = setTimeout(() => setWant(null), FORGET_MS);
    return () => clearTimeout(t);
  }, [want]);

  return {
    arrival,
    /** 누르기 직전. focus = 키보드로 눌렀는지 */
    expect: (focus: boolean) => {
      setArrival(null);
      setWant({ before: ids, focus, settled: false });
    },
    /** 액션이 끝났을 때. 못 받았으면 바로 잊는다 */
    settle: (ok: boolean) => setWant((w) => (ok && w ? { ...w, settled: true } : null)),
  };
}

/** 하늘색 테두리를 켜 두는 시간과 그 뒤 사라지는 시간 */
const HOLD_MS = 600;
const FADE_MS = 1500;

/**
 * 막 붙은 소식 카드로 화면을 옮기고(가운데) 잠깐 하늘색 테두리·바깥 고리로 짚는다. 고리는 box-shadow라 자리가 밀리지 않는다.
 * 동작 줄이기면 스크롤은 바로 옮기고 테두리는 번지지 않고 켰다 끈다
 */
export function useArrivalHighlight(arrival: Arrival | null, card: RefObject<HTMLElement | null>, title: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = card.current;
    if (!arrival || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    // 키보드로 눌렀으면 새 소식 제목으로 초점을 옮긴다(스크롤은 위에서 한 번만)
    if (arrival.focus) title.current?.focus({ preventScroll: true });
    const css = getComputedStyle(el);
    const sky = css.getPropertyValue("--color-sky").trim() || "#1A8FE0";
    const tint = css.getPropertyValue("--color-sky-tint").trim() || "#E1F2FF";
    const on = { borderColor: sky, boxShadow: `0 0 0 4px ${tint}` };
    // 끝 모습은 적지 않는다(카드의 지금 테두리로 돌아간다). 클래스는 건드리지 않아 듣는 중 테두리와 섞이지 않는다
    const anim = el.animate([{ ...on, offset: 0 }, { ...on, offset: HOLD_MS / (HOLD_MS + FADE_MS), easing: reduce ? "steps(1, end)" : "ease-out" }], {
      duration: HOLD_MS + FADE_MS,
    });
    return () => anim.cancel();
  }, [arrival, card, title]);
}
