"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconClose, IconMenu } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { NavLinks } from "./NavLinks";

/**
 * 모바일 왼쪽 서랍 메뉴. 위쪽 막대의 ☰로 연다(데스크톱은 SideNav가 늘 보인다).
 * 네이티브 <dialog>라 포커스 가두기·Esc·바깥 누르기로 닫기가 되고, 앱의 안드로이드 뒤로 가기도 닫는다(lib/native/shell.ts).
 * 닫을 때는 왼쪽으로 밀려 들어간 뒤에 닫는다(globals.css의 .drawer).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 열면 첫 링크 대신 패널에 포커스를 둔다(로고에 포커스 테두리가 생기지 않게. Tab으로는 링크로 간다)
  useEffect(() => {
    const d = ref.current;
    if (!open || !d || d.open) return;
    d.showModal();
    panelRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    const d = ref.current;
    if (!d?.open || d.dataset.closing !== undefined) return;
    d.dataset.closing = "";
    const anims = panelRef.current?.getAnimations() ?? [];
    void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
      delete d.dataset.closing;
      d.close();
    });
  }, []);

  // 다른 화면으로 옮기면 닫는다(메뉴 링크를 누른 경우 말고도, 뒤로 가기 등)
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center rounded-xl text-ink hover:bg-snow"
      >
        <IconMenu className="size-7" />
      </button>
      <dialog
        ref={ref}
        aria-label="메뉴"
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="drawer m-0 h-dvh max-h-none w-[min(300px,84vw)] max-w-none bg-transparent p-0"
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="drawer-panel flex h-full flex-col outline-none rounded-r-3xl border-r-2 border-line bg-white px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] text-ink"
        >
          <div className="flex items-center justify-between">
            <Link href="/" onClick={close} aria-label="맹고 소개" className="flex items-center gap-2 px-3 no-underline">
              <MangoIcon className="size-9" />
              <span className="text-[28px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
              <BetaBadge />
            </Link>
            <button type="button" aria-label="메뉴 닫기" onClick={close} className="flex size-11 items-center justify-center rounded-xl text-faint hover:bg-snow hover:text-ink">
              <IconClose className="size-6 [stroke-width:2.4]" />
            </button>
          </div>
          <div className="mt-8">
            <NavLinks onNavigate={close} />
          </div>
        </div>
      </dialog>
    </>
  );
}
