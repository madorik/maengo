"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * 되돌리기 알림(2026-10-18). 누르는 즉시 지워지는 동작(플레이어·플레이리스트에서 빼기, 비우기, 관심사 ✕) 뒤에 잠깐 뜬다.
 * 한 번에 하나만: 새로 뜨면 앞의 것을 갈아 끼운다(되돌릴 수 있는 건 마지막 하나). 5초 뒤, 다른 화면으로 옮기면, Esc로 사라지고,
 * 손가락·마우스를 올려 두거나 포커스가 있는 동안은 기다린다. 글은 몇 글자만('뺐어요' + '되돌리기').
 * 자리는 아래 가운데, 오른쪽 아래 플레이어 버튼 위(글 화면은 '이 글 듣기' 막대 위). 모바일에서 플레이어 창이 펼쳐져 있거나 듣기 화면이면 위쪽.
 * 시트(<dialog>)가 열려 있으면 그 안에 그린다. 모달이 열리면 바깥은 가려지고 눌리지도 않기 때문이다.
 * (app) 레이아웃에 한 번 둔다.
 */

const SHOW_MS = 5000;
/** 올려 두었다 뗀 뒤에 남는 시간이 이보다 짧으면 이만큼은 더 둔다 */
const MIN_MS = 1500;

interface Item {
  id: number;
  label: string;
  onUndo?: () => void;
  /** 띄울 때 모바일 플레이어 창이 펼쳐져 있었는지(창이 아래를 다 덮어서 위쪽에 띄운다) */
  top: boolean;
}

export interface ToastApi {
  /** 되돌리기 알림. 앞의 알림은 사라진다 */
  showUndo: (o: { label: string; onUndo: () => void }) => void;
  /** 버튼 없이 글만(되돌리지 못했을 때 같은 오류) */
  showError: (label: string) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<Item | null>(null);
  const seq = useRef(0);
  const api = useMemo<ToastApi>(() => {
    // 플레이어 창(ListenWidget)은 모바일에서 화면 아래를 거의 다 덮는다
    const top = () => window.innerWidth < 1024 && !!document.getElementById("listen-widget");
    return {
      showUndo: ({ label, onUndo }) => setItem({ id: ++seq.current, label, onUndo, top: top() }),
      showError: (label) => setItem({ id: ++seq.current, label, top: top() }),
      dismiss: () => setItem(null),
    };
  }, []);

  // 다른 화면으로 옮기면 걷는다(되돌릴 대상이 이제 화면에 없다)
  const pathname = usePathname();
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setItem(null);
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost item={item} onDone={api.dismiss} pathname={pathname} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast는 ToastProvider 안에서만 쓸 수 있어요");
  return api;
}

/** 알림을 그릴 곳: 맨 위에 열린 <dialog>, 없으면 body */
function topLayer(): HTMLElement {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return open.length ? open[open.length - 1]! : document.body;
}

/** 시트가 열리고 닫힐 때(open 속성) 그릴 곳을 다시 고른다. 알림이 떠 있는 동안은 시트가 통째로 빠지는 것(조건부 렌더)도 본다 */
function useLayer(watchTree: boolean): HTMLElement | null {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: watchTree });
      return () => mo.disconnect();
    },
    [watchTree],
  );
  return useSyncExternalStore(subscribe, topLayer, () => null);
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ToastHost({ item, onDone, pathname }: { item: Item | null; onDone: () => void; pathname: string }) {
  // 사라지는 알림은 흐려질 때까지 잠깐 더 그린다
  const [shown, setShown] = useState<Item | null>(item);
  if (item && item !== shown) setShown(item);
  const leaving = !item && !!shown;
  const layer = useLayer(!!shown);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pausedId, setPausedId] = useState(0);
  const paused = !!item && pausedId === item.id;
  const inSheet = layer?.tagName === "DIALOG";
  const top = !inSheet && !!shown && (shown.top || pathname.startsWith("/listen"));

  // 들어오기: 자리 쪽에서 살짝 떠오른다(동작 줄이기면 흐리게만). 시트가 닫혀 body로 옮겨 그려질 때도 다시
  const shownId = shown?.id;
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !shownId || leaving) return;
    const dy = top ? -12 : 12;
    el.animate(
      reducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${dy}px) scale(0.97)` },
            { opacity: 1, transform: "none" },
          ],
      { duration: reducedMotion() ? 150 : 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
    );
  }, [shownId, layer, top, leaving]);

  // 나가기: 흐려진 뒤에 지운다. 그사이 새 알림이 오면 그만둔다
  useEffect(() => {
    if (!leaving) return;
    let live = true;
    const done = () => {
      if (live) setShown(null);
    };
    const anim = cardRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" });
    if (anim) anim.finished.then(done, done);
    const t = window.setTimeout(done, anim ? 400 : 0);
    return () => {
      live = false;
      window.clearTimeout(t);
      anim?.cancel();
    };
  }, [leaving]);

  // 저절로 사라지기. 올려 두면 멈췄다가 남은 시간만큼(너무 짧으면 MIN_MS) 더 둔다
  const left = useRef({ id: 0, ms: SHOW_MS });
  useEffect(() => {
    if (!item || paused) return;
    if (left.current.id !== item.id) left.current = { id: item.id, ms: SHOW_MS };
    const started = Date.now();
    const t = window.setTimeout(onDone, Math.max(left.current.ms, MIN_MS));
    return () => {
      window.clearTimeout(t);
      left.current.ms -= Date.now() - started;
    };
  }, [item, paused, onDone]);

  // Esc로 닫기. 시트가 열려 있으면 Esc는 시트 몫이라 알림에 포커스가 있을 때만 알림을 닫는다
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const inside = !!cardRef.current?.contains(document.activeElement);
      if (!inside && document.querySelector("dialog[open]")) return;
      if (inside) e.preventDefault();
      onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onDone]);

  if (!layer) return null;
  // 아래 자리: 시트 안이면 시트 바닥, 글 화면은 '이 글 듣기' 막대 + 플레이어 버튼(66px) 위, 그 밖은 플레이어 버튼 위
  const place = inSheet
    ? "bottom-[max(16px,calc(env(safe-area-inset-bottom)+12px))]"
    : top
      ? "top-[calc(env(safe-area-inset-top)+12px)]"
      : pathname.startsWith("/article")
        ? "bottom-[calc(var(--listen-bar-h,104px)+88px)]"
        : "bottom-[calc(env(safe-area-inset-bottom)+92px)] lg:bottom-[100px]";
  const undo = () => {
    const fn = shown?.onUndo;
    onDone();
    fn?.();
  };

  return createPortal(
    <div role="status" aria-live="polite" aria-atomic="true" className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${place}`}>
      {shown && (
        <div
          key={shown.id}
          ref={cardRef}
          inert={leaving}
          onPointerEnter={() => setPausedId(shown.id)}
          onPointerLeave={() => setPausedId(0)}
          onFocus={() => setPausedId(shown.id)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPausedId(0);
          }}
          className={`flex min-h-12 min-w-0 max-w-[420px] items-center gap-2 rounded-2xl bg-[#1F2340] py-1 pl-4 text-white shadow-[0_10px_30px_rgb(31_35_64/0.28)] dark:bg-[#2A2E40] dark:ring-2 dark:ring-[#383D53] ${
            shown.onUndo ? "pr-1.5" : "pr-4"
          } ${leaving ? "" : "pointer-events-auto"}`}
        >
          <span className="min-w-0 truncate text-[15px] font-bold">{shown.label}</span>
          {shown.onUndo && (
            <button type="button" onClick={undo} className="min-h-11 shrink-0 rounded-xl px-3 text-[15px] font-extrabold text-mango hover:bg-white/10 active:bg-white/15">
              되돌리기
            </button>
          )}
        </div>
      )}
    </div>,
    layer,
  );
}
