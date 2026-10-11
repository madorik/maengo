"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { isAppUserAgent } from "@/lib/app-client";
import { animateSpring, projectMomentum, rubberband } from "@/lib/spring";
import { NAV } from "./nav";

// 앱에서 오늘·보관함·설정을 좌우로 밀어서 옮긴다(메뉴 순서와 같다. 왼쪽으로 밀면 다음 탭).
// 화면은 손가락을 1:1로 따라오고, 갈 탭이 없는 쪽은 고무줄처럼 버틴다. 드러나는 쪽에는 갈 탭이 떠서 넘어갈 만큼 끌면 망고색이 된다.
// 손을 떼면 끈 거리에 던진 속도를 더한 예상 위치로 넘길지 정하고, 그 속도를 이어받아 밀려나고 새 화면은 반대쪽에서 들어온다.
// 앱에서만 켠다. 웹 브라우저는 좌우 스와이프를 뒤로·앞으로 가기에 쓴다.

const SLOP = 10; // 가로·세로를 정하기 전에 움직여야 하는 거리(px)
const EDGE = 20; // 화면 가장자리에서 시작한 스와이프는 시스템 뒤로 가기 몫이라 비켜 준다
const COMMIT = 0.3; // 예상 위치가 화면 너비의 이만큼을 넘으면 옆 탭으로 넘어간다
const EXIT = 0.5; // 넘어갈 때 지금 화면이 흐려지며 밀려나는 거리(화면 너비 비율)
const ENTER = 0.25; // 새 화면이 들어오기 시작하는 거리(반대쪽, 화면 너비 비율)
const NAV_TIMEOUT = 4000; // 이 안에 화면이 안 바뀌면 제자리로 돌린다
// 글 입력·고르기, 따로 끄는 곳, 떠 있는 창 안에서는 스와이프하지 않는다
const SKIP = "input, textarea, select, [contenteditable='true'], [data-no-swipe], dialog";

type Phase = "idle" | "pending" | "drag" | "settle" | "leave" | "enter";
type Tab = (typeof NAV)[number];

export function SwipeTabs({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const index = NAV.findIndex((n) => n.href === pathname);
  const prev: Tab | undefined = index > 0 ? NAV[index - 1] : undefined;
  const next: Tab | undefined = index >= 0 ? NAV[index + 1] : undefined;

  const mainRef = useRef<HTMLElement>(null);
  const prevHintRef = useRef<HTMLDivElement>(null);
  const nextHintRef = useRef<HTMLDivElement>(null);
  // 리스너는 한 번만 붙이고, 지금 탭은 여기서 읽는다
  const here = useRef({ pathname, prev, next, router });
  useLayoutEffect(() => {
    here.current = { pathname, prev, next, router };
  });
  const g = useRef({ phase: "idle" as Phase, x: 0, v: 0, dir: 0, stop: () => {}, timer: 0 });

  // 옆 탭은 미리 받아 둬서 넘기자마자 뜨게 한다
  useEffect(() => {
    if (!isAppUserAgent(navigator.userAgent)) return;
    if (prev) router.prefetch(prev.href);
    if (next) router.prefetch(next.href);
  }, [router, prev, next]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !isAppUserAgent(navigator.userAgent)) return;
    const s = g.current;
    const paint = (x: number, opacity: number, hints: boolean) =>
      paintFrame(el, prevHintRef.current, nextHintRef.current, x, opacity, hints);
    // 세로 스크롤·확대는 브라우저가, 가로는 여기서 받는다
    el.style.touchAction = "pan-y pinch-zoom";
    let id = -1;
    let startX = 0;
    let startY = 0;
    let base = 0;
    let samples: { t: number; x: number }[] = [];

    const settle = (velocity: number) => {
      s.phase = "settle";
      s.stop = animateSpring({
        from: s.x,
        to: 0,
        velocity,
        response: 0.3,
        onUpdate: (x) => {
          s.x = x;
          paint(x, 1, true);
        },
        onRest: () => {
          s.phase = "idle";
          paint(0, 1, false);
        },
      });
    };

    const leave = (href: string, velocity: number) => {
      const { pathname: from, router: r } = here.current;
      s.phase = "leave";
      s.dir = Math.sign(s.x);
      const x0 = s.x;
      const x1 = reducedMotion() ? x0 : s.dir * Math.max(innerWidth * EXIT, Math.abs(x0) + 40);
      // 진행도 0→1을 굴린다. 손을 뗀 속도는 남은 거리로 나눠 진행도의 속도로 넘긴다
      s.stop = animateSpring({
        from: 0,
        to: 1,
        velocity: x1 === x0 ? 0 : velocity / (x1 - x0),
        response: 0.3,
        onUpdate: (p, pv) => {
          s.x = x0 + (x1 - x0) * p;
          s.v = (x1 - x0) * pv;
          paint(s.x, 1 - p, true);
        },
      });
      // 오늘에서 떠날 때만 기록을 쌓는다. 그래야 안드로이드 뒤로 가기가 늘 오늘로 돌아오고, 오늘에서는 앱을 내린다(lib/native/shell.ts)
      if (from === "/today") r.push(href);
      else r.replace(href);
      s.timer = window.setTimeout(() => {
        if (s.phase !== "leave") return;
        s.stop();
        paint(s.x, 1, false);
        settle(0);
      }, NAV_TIMEOUT);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || s.phase === "leave") return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t || !NAV.some((n) => n.href === here.current.pathname)) return;
      if (e.clientX < EDGE || e.clientX > innerWidth - EDGE) return;
      if (t.closest(SKIP) || document.querySelector("dialog[open]")) return;
      if (getSelection()?.isCollapsed === false || inHorizontalScroller(t, el)) return;
      // 되돌아가거나 들어오던 화면을 잡으면 지금 자리에서 이어서 끈다
      s.stop();
      base = s.x;
      id = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      samples = [{ t: e.timeStamp, x: e.clientX }];
      s.phase = base ? "drag" : "pending";
      if (base) paint(base, 1, true);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (s.phase === "pending") {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // 세로가 더 크면 스크롤에 양보한다
        if (Math.abs(dx) <= Math.abs(dy)) {
          id = -1;
          s.phase = "idle";
          return;
        }
        s.phase = "drag";
        startX += Math.sign(dx) * SLOP; // 문턱만큼 튀지 않게
      }
      if (s.phase !== "drag") return;
      samples.push({ t: e.timeStamp, x: e.clientX });
      while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
      const raw = base + (e.clientX - startX);
      const { prev: p, next: n } = here.current;
      const open = raw < 0 ? !!n : !!p;
      s.x = open ? raw : rubberband(raw, innerWidth);
      paint(s.x, 1, true);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (s.phase === "pending") {
        s.phase = "idle";
        return;
      }
      if (s.phase !== "drag") return;
      swallowNextClick();
      samples.push({ t: e.timeStamp, x: e.clientX });
      const v = releaseVelocity(samples, e.timeStamp);
      const { prev: p, next: n } = here.current;
      const target = s.x < 0 ? n : s.x > 0 ? p : undefined;
      const end = s.x + projectMomentum(v);
      // 마지막에 반대로 튕겼으면 위치가 멀어도 돌아간다
      const reversing = Math.abs(v) > 200 && Math.sign(v) !== Math.sign(s.x);
      if (target && !reversing && Math.sign(end) === Math.sign(s.x) && Math.abs(end) > innerWidth * COMMIT) {
        leave(target.href, v);
      } else settle(v);
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (s.phase === "drag") settle(0);
      else if (s.phase === "pending") s.phase = "idle";
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      s.stop();
      window.clearTimeout(s.timer);
      s.phase = "idle";
      s.x = 0;
      paint(0, 1, false);
      el.style.touchAction = "";
    };
  }, []);

  // 스와이프로 화면이 바뀌면 새 화면을 반대쪽에서 들여온다(밀려나던 속도를 이어받는다)
  useLayoutEffect(() => {
    const s = g.current;
    if (s.phase !== "leave") return;
    window.clearTimeout(s.timer);
    s.stop();
    const paint = (x: number, opacity: number, hints: boolean) =>
      paintFrame(mainRef.current, prevHintRef.current, nextHintRef.current, x, opacity, hints);
    const x0 = reducedMotion() ? 0 : -s.dir * innerWidth * ENTER;
    s.phase = "enter";
    s.x = x0;
    paint(x0, 0, false);
    s.stop = animateSpring({
      from: 0,
      to: 1,
      velocity: x0 ? Math.min(Math.max(s.v / -x0, 0), 8) : 0,
      response: 0.35,
      onUpdate: (p) => {
        s.x = x0 * (1 - p);
        paint(s.x, p, false);
      },
      onRest: () => {
        s.phase = "idle";
        paint(0, 1, false);
      },
    });
  }, [pathname]);

  return (
    <>
      <main ref={mainRef} className={className}>
        {children}
      </main>
      {prev && <EdgeHint ref={prevHintRef} tab={prev} side="left" />}
      {next && <EdgeHint ref={nextHintRef} tab={next} side="right" />}
    </>
  );
}

/** 끌 때 드러나는 쪽에 뜨는 갈 탭. 넘어갈 만큼 끌면 data-armed가 붙어 망고색이 된다 */
function EdgeHint({ ref, tab, side }: { ref: React.Ref<HTMLDivElement>; tab: Tab; side: "left" | "right" }) {
  const { Icon, label } = tab;
  return (
    <div
      ref={ref}
      aria-hidden
      className={`group pointer-events-none fixed top-1/2 z-10 flex flex-col items-center gap-1.5 opacity-0 ${side === "left" ? "left-4" : "right-4"}`}
    >
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-line bg-white text-sub shadow-[0_8px_24px_rgb(31_35_64/0.12)] transition-colors duration-150 group-data-[armed]:border-mango group-data-[armed]:bg-mango-tint group-data-[armed]:text-mango-deep">
        <Icon className="size-7" />
      </span>
      <span className="text-[13px] font-extrabold text-sub transition-colors duration-150 group-data-[armed]:text-mango-deep">{label}</span>
    </div>
  );
}

/** 한 프레임 그리기. 멈춰 있을 때는 transform을 지워서 안쪽의 fixed 요소가 화면 기준을 잃지 않게 한다 */
function paintFrame(
  main: HTMLElement | null,
  prevHint: HTMLElement | null,
  nextHint: HTMLElement | null,
  x: number,
  opacity: number,
  hints: boolean,
) {
  if (!main) return;
  const still = Math.abs(x) < 0.5 && opacity >= 1;
  main.style.transform = still ? "" : `translate3d(${x}px,0,0)`;
  main.style.opacity = opacity >= 1 ? "" : String(opacity);
  main.style.willChange = still ? "" : "transform, opacity";
  // 오른쪽으로 끌면(x > 0) 왼쪽에 이전 탭이, 왼쪽으로 끌면 오른쪽에 다음 탭이 드러난다
  const reach = innerWidth * COMMIT;
  for (const [hint, sign] of [
    [prevHint, 1],
    [nextHint, -1],
  ] as const) {
    if (!hint) continue;
    const p = hints ? Math.min(Math.max((x * sign) / reach, 0), 1) : 0;
    hint.style.opacity = p ? String(p * opacity) : "";
    hint.style.transform = `translate3d(${(1 - p) * -24 * sign}px,-50%,0) scale(${0.7 + 0.3 * p})`;
    hint.toggleAttribute("data-armed", p >= 1);
  }
}

/** 화면 안쪽에서 가로로 스크롤되는 줄(보관함 카테고리 칩 등)에서 시작했는지 */
function inHorizontalScroller(from: Element, stop: Element): boolean {
  for (let n: Element | null = from; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const o = getComputedStyle(n).overflowX;
      if (o === "auto" || o === "scroll") return true;
    }
  }
  return false;
}

/** 손을 뗀 순간의 속도(px/초). 떼기 전에 멈췄다면 0 */
function releaseVelocity(samples: { t: number; x: number }[], now: number): number {
  const recent = samples.filter((p) => now - p.t <= 100);
  if (recent.length < 2) return 0;
  const a = recent[0];
  const b = recent[recent.length - 1];
  return b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
}

/** 끌다가 손을 뗀 자리의 카드·링크가 눌리지 않게 바로 다음 클릭 하나를 삼킨다 */
function swallowNextClick() {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 100);
}

function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
