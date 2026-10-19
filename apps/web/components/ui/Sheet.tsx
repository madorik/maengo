"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { IconClose } from "@/components/icons";
import { releaseVelocity, SHEET_SLOP, sheetOffset, shouldDismiss } from "@/lib/sheet-drag";
import { animateSpring } from "@/lib/spring";

type Phase = "closed" | "enter" | "open" | "drag" | "settle" | "exit";

// 시트 안에서 끌기를 시작하지 않는 곳: 글 입력·고르기, 순서 바꾸기 손잡이(dnd-kit), 따로 끄는 곳
const NO_DRAG = "input, textarea, select, [contenteditable='true'], [aria-roledescription='sortable'], [data-no-sheet-drag]";

/**
 * 아래에서 올라오는 시트. 네이티브 <dialog>(showModal)라 포커스 가두기·Esc·앱의 안드로이드 뒤로 가기(lib/native/shell.ts의 requestClose)가 된다.
 * - 열고 닫을 때 아래에서 스프링으로 올라오고 내려가며, 바탕은 시트가 올라온 만큼 어두워진다. 움직이는 중에 다시 잡을 수 있다. 동작 줄이기면 밀지 않고 흐려지기만 한다.
 * - 손잡이·제목 줄을, 또는 내용이 맨 위일 때 내용을 아래로 끌면 손가락을 따라 내려오고, 충분히 끌었거나 아래로 던지면 닫히고 아니면 튕겨 돌아간다(lib/sheet-drag.ts). 터치만.
 * - ✕·바깥 누르기·Esc·끌어 내리기로 닫으면 다 내려간 뒤에 onClose를 부른다(열 때만 그리는 곳도 끝까지 보인다). 부모가 open을 false로 바꾸면 내려간 뒤에 닫는다.
 * - 열린 동안 뒤 화면은 스크롤되지 않는다(globals.css의 html:has(.sheet[open]), 서랍 메뉴와 같은 방식이라 스크롤 자리도 그대로). 닫으면 연 버튼으로 포커스를 돌려준다.
 * - full이면 화면을 꽉 채운다(앱의 플레이어). 손잡이·제목 줄로 끌어 내려 닫는 건 같고, 안쪽은 스크롤하지 않으니 스크롤하는 부분은
 *   data-no-sheet-drag를 달아 거기서 끌어도 시트가 내려오지 않게 한다.
 */
export function Sheet({
  title,
  open,
  onClose,
  full = false,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  /** 화면을 꽉 채운다(위 안전 영역까지). 기본은 아래에서 85%까지 올라오는 시트 */
  full?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  const ctl = useRef<{ setOpen: (open: boolean) => void; dismiss: () => void } | null>(null);

  // 움직임·끌기는 한 번 붙여 두고 여기 안의 값으로만 다룬다(그릴 때마다 다시 만들지 않는다)
  useEffect(() => {
    const d = dialogRef.current;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const body = bodyRef.current;
    if (!d || !panel || !scrim || !body) return;
    let phase: Phase = "closed";
    /** 시트가 내려간 거리(px). 0이면 다 열림, 음수면 위로 끌어 올린 고무줄 */
    let y = 0;
    /** 흐림(동작 줄이기에서만 1보다 작다) */
    let o = 1;
    /** 시트 높이. 내용이 바뀌면 달라져서 움직일 때마다 잰다 */
    let h = 0;
    let stop = () => {};
    /** 부모가 open=false로 닫는 중(그때는 다시 잡지 않고 onClose도 부르지 않는다) */
    let forced = false;
    let opener: HTMLElement | null = null;
    let touch: {
      id: number;
      x0: number;
      y0: number;
      base: number;
      mode: "pending" | "drag" | "skip";
      inBody: boolean;
      /** 움직이던 시트를 잡았으면 그때 하던 일(끌지 않고 놓으면 이어서 한다) */
      held: Phase | null;
      samples: { t: number; y: number }[];
    } | null = null;

    const measure = () => {
      h = panel.offsetHeight;
    };
    // 다 열려 멈춰 있을 때는 transform을 지운다
    const paint = () => {
      panel.style.transform = y ? `translate3d(0,${y}px,0)` : "";
      panel.style.opacity = o < 1 ? String(o) : "";
      scrim.style.opacity = String((h ? Math.min(Math.max(1 - y / h, 0), 1) : 1) * o);
    };

    /** to(px)까지 스프링으로 옮긴다. 동작 줄이기면 자리는 그대로(열 때는 제자리로) 두고 흐림만 굴린다. until을 넘으면 끝까지 기다리지 않고 done */
    const glide = (to: number, opts: { velocity?: number; response?: number; damping?: number; until?: number; done?: () => void }) => {
      stop();
      let fired = false;
      const done = () => {
        if (fired) return;
        fired = true;
        opts.done?.();
      };
      if (reducedMotion()) {
        const showing = to <= 0;
        if (showing) {
          y = 0;
          paint();
        }
        stop = animateSpring({
          from: o,
          to: showing ? 1 : 0,
          response: 0.2,
          onUpdate: (v) => {
            o = v;
            paint();
          },
          onRest: done,
        });
        return;
      }
      o = 1;
      stop = animateSpring({
        from: y,
        to,
        velocity: opts.velocity ?? 0,
        response: opts.response ?? 0.35,
        damping: opts.damping ?? 1,
        onUpdate: (v) => {
          y = v;
          paint();
          // 스프링 안에서는 멈출 수 없어서(다음 프레임을 이미 걸어 둔다) 이 프레임이 끝난 뒤에 끝낸다
          if (opts.until !== undefined && v >= opts.until) queueMicrotask(done);
        },
        onRest: done,
      });
    };

    const returnFocus = () => {
      const to = opener;
      opener = null;
      const now = document.activeElement;
      // 브라우저가 이미 돌려줬으면 그대로 둔다
      if (to?.isConnected && (!now || now === document.body || d.contains(now))) to.focus({ preventScroll: true });
    };

    /**
     * 닫힌 패널을 제자리(transform 없음)로 되돌린다. 내려간 자리의 transform이 남은 채 다음에 showModal()을 부르면 브라우저가 안의 ✕에 포커스를 주며
     * 그 버튼이 보이게 dialog를 스크롤해 버려(overflow가 있는 상자라) 시트가 위로 밀린 채 열렸다(2026-10-19 앱에서 재현: 끌어 닫고 탭을 옮긴 뒤 다시 열면 상태 표시줄을 가림)
     */
    const park = () => {
      y = 0;
      o = 1;
      paint();
      d.scrollTop = 0;
    };

    /** 다 내려간 뒤 닫는다 */
    const close = () => {
      stop();
      const notify = !forced;
      phase = "closed";
      forced = false;
      if (d.open) d.close();
      park();
      returnFocus();
      if (notify) onCloseRef.current();
    };

    const show = () => {
      if (!d.open) {
        opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // 열기 전에 패널을 제자리에 둔다(park 참고). 열고 나서 아래 자리(y = h)로 옮긴 뒤 올라오는 건 같은 틱이라 깜빡이지 않는다
        park();
        d.showModal();
        phase = "closed";
      }
      measure();
      if (phase === "closed") {
        // 아래에 내려가 있는 자리(동작 줄이기면 제자리에 투명하게)에서 시작한다
        const r = reducedMotion();
        y = r ? 0 : h;
        o = r ? 0 : 1;
        paint();
      }
      forced = false;
      phase = "enter";
      glide(0, {
        done: () => {
          phase = "open";
        },
      });
    };

    /** 내려가 닫는다. notify면 다 내려간 뒤 onClose(시트 안에서 닫았을 때), 아니면 부모가 이미 닫은 것 */
    const dismiss = (velocity: number, notify: boolean) => {
      if (phase === "closed" || !d.open) return;
      if (!notify) forced = true;
      if (phase === "exit") return;
      phase = "exit";
      touch = null;
      measure();
      // 바닥보다 조금 더 아래를 겨눠서 꼬리 없이 빠지고, 바닥을 지나면 바로 닫는다
      glide(h + 24, { velocity: Math.max(velocity, 0), response: 0.3, until: h, done: close });
    };

    /** 끌다 놓았는데 닫지 않을 때: 손을 뗀 속도를 이어받아 튕겨 돌아간다 */
    const settle = (velocity: number) => {
      phase = "settle";
      glide(0, {
        velocity,
        response: 0.3,
        damping: 0.85,
        done: () => {
          phase = "open";
        },
      });
    };

    /** 잡았다가 끌지 않고 놓으면 하던 일을 마저 한다 */
    const resume = (held: Phase | null) => {
      if (held === "exit") dismiss(0, true);
      else if (held) settle(0);
    };

    const find = (list: TouchList, id: number) => Array.from(list).find((t) => t.identifier === id);

    const onTouchStart = (e: TouchEvent) => {
      if (touch || e.touches.length > 1 || phase === "closed" || forced) return;
      const t = e.changedTouches[0];
      const target = e.target instanceof Element ? e.target : null;
      if (!t || !target || target.closest(NO_DRAG)) return;
      // 움직이던 시트를 잡으면 그 자리에 멈춘다(끌면 거기서 이어서 끈다)
      const moving = phase === "enter" || phase === "exit" || phase === "settle";
      const held = moving ? phase : null;
      if (moving) {
        stop();
        phase = "drag";
      }
      touch = { id: t.identifier, x0: t.clientX, y0: t.clientY, base: y, mode: "pending", inBody: body.contains(target), held, samples: [{ t: e.timeStamp, y: t.clientY }] };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touch || touch.mode === "skip") return;
      const t = find(e.changedTouches, touch.id);
      if (!t) return;
      const dx = t.clientX - touch.x0;
      const dy = t.clientY - touch.y0;
      if (touch.mode === "pending") {
        // 내용이 내려가 있거나 위로 밀면 내용 스크롤 몫
        if (touch.inBody && (body.scrollTop > 0 || dy < 0)) {
          touch.mode = "skip";
          resume(touch.held);
          return;
        }
        // 옆으로 미는 중이면 막지 않는다(안쪽 가로 스크롤·다른 손짓이 그대로 되게). 문턱을 넘으면 끌기를 그만둔다
        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) < SHEET_SLOP) return;
          touch.mode = "skip";
          resume(touch.held);
          return;
        }
        // 아래로 당기기 시작: 안쪽 스크롤(iOS 고무줄)이 먼저 잡지 않게 문턱 전부터 막아 둔다
        if (e.cancelable) e.preventDefault();
        if (Math.abs(dy) < SHEET_SLOP) return;
        touch.mode = "drag";
        phase = "drag";
        stop();
        measure();
        touch.y0 += Math.sign(dy) * SHEET_SLOP; // 문턱만큼 튀지 않게
      }
      if (e.cancelable) e.preventDefault();
      touch.samples.push({ t: e.timeStamp, y: t.clientY });
      while (touch.samples.length > 2 && e.timeStamp - touch.samples[0]!.t > 100) touch.samples.shift();
      y = sheetOffset(touch.base + t.clientY - touch.y0);
      paint();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = touch && find(e.changedTouches, touch.id);
      if (!touch || !t) return;
      const was = touch;
      touch = null;
      if (was.mode !== "drag") return resume(was.mode === "pending" ? was.held : null);
      swallowNextClick();
      was.samples.push({ t: e.timeStamp, y: t.clientY });
      const v = releaseVelocity(was.samples, e.timeStamp);
      if (shouldDismiss(y, v, h)) dismiss(v, true);
      else settle(v);
    };

    const onTouchCancel = (e: TouchEvent) => {
      if (!touch || !find(e.changedTouches, touch.id)) return;
      const was = touch;
      touch = null;
      if (was.mode === "drag") settle(0);
      else if (was.mode === "pending") resume(was.held);
    };

    // Esc·requestClose(안드로이드 뒤로 가기): 바로 닫지 않고 내려간 뒤에 닫는다
    const onCancel = (e: Event) => {
      e.preventDefault();
      dismiss(0, true);
    };
    // 브라우저가 애니메이션 없이 닫았을 때(Esc를 거듭 누름, requestClose가 없는 웹뷰의 close() 등). 우리가 닫았으면 이미 closed
    const onDialogClose = () => {
      if (d.open || phase === "closed") return;
      const notify = !forced;
      stop();
      touch = null;
      phase = "closed";
      forced = false;
      park();
      returnFocus();
      if (notify) onCloseRef.current();
    };

    ctl.current = { setOpen: (v) => (v ? show() : dismiss(0, false)), dismiss: () => dismiss(0, true) };
    d.addEventListener("cancel", onCancel);
    d.addEventListener("close", onDialogClose);
    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd);
    panel.addEventListener("touchcancel", onTouchCancel);
    return () => {
      ctl.current = null;
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("close", onDialogClose);
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", onTouchEnd);
      panel.removeEventListener("touchcancel", onTouchCancel);
      stop();
      // 열린 채로 빠지면(부모가 시트를 통째로 지움) 닫고 포커스를 돌려준다
      if (d.open) {
        phase = "closed";
        d.close();
        returnFocus();
      }
    };
  }, []);

  useEffect(() => {
    ctl.current?.setOpen(open);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="sheet fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-clip bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      {/* 바탕: 시트가 올라온 만큼 어두워지고, 누르면 닫힌다 */}
      <div ref={scrimRef} aria-hidden onClick={() => ctl.current?.dismiss()} className="absolute inset-0 touch-none bg-[rgb(31_35_64/0.55)] opacity-0" />
      {/* 위로 끌어 올리면(고무줄) 아래 빈틈이 보이지 않게 바탕색을 아래로 조금 더 깐다(after) */}
      <div
        ref={panelRef}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-[640px] flex-col bg-paper after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-paper ${
          full ? "h-dvh pt-[env(safe-area-inset-top)]" : "max-h-[85dvh] rounded-t-3xl"
        }`}
      >
        {/* 손잡이·제목 줄. 여기는 늘 끌 수 있다 */}
        <div className="touch-none px-5 pt-2">
          <span aria-hidden className="mx-auto block h-[5px] w-10 rounded-full bg-line-dark" />
          <div className="mt-1.5 flex items-center justify-between">
            <h2 className="text-[20px] font-black">{title}</h2>
            {/* 고른 값은 누르는 즉시 저장된다. 여기서는 창만 닫는다(바깥 누르기·Esc·끌어 내리기로도 닫힌다) */}
            <button type="button" onClick={() => ctl.current?.dismiss()} aria-label="닫기" className="flex size-11 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-ink">
              <IconClose className="size-6 [stroke-width:2.4]" />
            </button>
          </div>
        </div>
        {full ? (
          // 꽉 찬 시트는 안쪽이 자리를 나눠 쓰고(재생 목록·대본가 따로 스크롤) 아래 여백도 안쪽이 챙긴다
          <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="mt-2">{children}</div>
          </div>
        )}
      </div>
    </dialog>
  );
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 끌다가 손을 뗀 자리의 버튼이 눌리지 않게 바로 다음 클릭 하나를 삼킨다 */
function swallowNextClick() {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 100);
}
