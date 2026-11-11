"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconChevronDown } from "@/components/icons";
import { AiSparkle } from "@/components/ui/AiSparkle";
import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/analytics";
import { isAppUserAgent } from "@/lib/app-client";
import { claimDock, releaseDock, useDock } from "@/lib/float-dock";
import type { FeedItem } from "@/lib/types";
import { AskChat } from "./AskChat";

const noSubscribe = () => () => {};

/**
 * 글 화면 오른쪽 아래 맹고 AI 버튼(2026-11-03 사용자 결정: 플레이어 망고 버튼처럼 떠 있게, 글 화면에서는 그 자리를 맹고 AI가 쓴다).
 * 헤드폰 없는 맹고 + AI 표시로 플레이어(헤드폰 맹고)와 구분한다. 플레이어가 돌아 떠 있으면 그 위로 올라간다(lib/float-dock.ts).
 * 웹은 플레이어처럼 버튼 위에 창으로, 앱은 아래 시트로 연다. 플레이어 창과는 한 번에 하나만 편다.
 */
export function AskDock({ item }: { item: Pick<FeedItem, "clusterId" | "category" | "title"> }) {
  const [open, setOpen] = useState(false);
  const dock = useDock();
  const inApp = useSyncExternalStore(noSubscribe, () => isAppUserAgent(navigator.userAgent), () => false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // 플레이어 창을 펴면 접는다
  if (open && dock.open === "player") setOpen(false);
  useEffect(() => {
    if (!open) releaseDock("ask");
  }, [open]);
  useEffect(() => () => releaseDock("ask"), []);

  // 웹 창: Esc로 닫고 버튼으로 포커스를 돌린다
  useEffect(() => {
    if (!open || inApp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inApp]);

  const toggle = () => {
    if (!open) {
      claimDock("ask");
      track("ask", { category: item.category, action: "open" });
    }
    setOpen(!open);
  };
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  // 플레이어 창이 펴져 있으면 그 창을 가리지 않게 버튼을 숨긴다
  if (dock.open === "player") return null;

  // 플레이어 버튼(높이 64px)이 떠 있으면 그 위로(사이 12px). 플레이어와 같은 오른쪽 여백
  const bottom = dock.player ? "bottom-[calc(var(--listen-bar-h,104px)+88px)]" : "bottom-[calc(var(--listen-bar-h,104px)+12px)]";

  const launcher = (
    <button
      ref={launcherRef}
      type="button"
      data-tour="ask"
      onClick={toggle}
      aria-expanded={open}
      aria-haspopup={inApp ? "dialog" : undefined}
      aria-controls={open && !inApp ? "ask-window" : undefined}
      aria-label={open && !inApp ? "맹고 AI 창 닫기" : "맹고 AI에게 물어보기"}
      className={`pop tile pointer-events-auto relative flex rounded-full p-1.5 shadow-[0_8px_24px_rgb(31_35_64/0.16)] hover:bg-snow ${open ? "border-mango" : ""}`}
    >
      {/* AI 반짝이(2026-11-11 사용자: 맹고 얼굴 대신 제미나이 같은 AI 아이콘, 'AI' 꼬리표는 반짝이가 대신해서 뺌) */}
      <span className="flex size-12 items-center justify-center rounded-full bg-snow">
        <AiSparkle className="size-8" />
      </span>
    </button>
  );

  if (inApp) {
    return (
      <>
        <Sheet title="맹고 AI" open={open} onClose={() => setOpen(false)}>
          {open && (
            <>
              <p className="-mt-1 mb-3 truncate text-[13px] font-bold text-sub">{item.title}</p>
              <AskChat item={item} variant="sheet" />
            </>
          )}
        </Sheet>
        <div className={`pointer-events-none fixed right-3 z-40 lg:right-6 ${bottom}`}>{launcher}</div>
      </>
    );
  }

  return (
    <div className={`pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-3 lg:right-6 ${bottom}`}>
      {open && (
        <div
          id="ask-window"
          role="dialog"
          aria-labelledby="ask-window-title"
          className="rise tile pointer-events-auto flex max-h-[min(560px,calc(100dvh-var(--listen-bar-h,104px)-200px-env(safe-area-inset-top)))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden shadow-[0_16px_48px_rgb(31_35_64/0.2)]"
        >
          <header className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-snow">
              <AiSparkle className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="ask-window-title" className="text-[16px] font-black">
                맹고 AI
              </h2>
              <p className="truncate text-[12px] font-bold text-sub">{item.title}</p>
            </div>
            <button type="button" aria-label="맹고 AI 창 닫기" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-sub">
              <IconChevronDown className="size-6" />
            </button>
          </header>
          <AskChat item={item} variant="window" />
        </div>
      )}
      {launcher}
    </div>
  );
}
