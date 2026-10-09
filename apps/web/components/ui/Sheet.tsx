"use client";

import { useEffect, useRef } from "react";

/** 아래에서 올라오는 시트. 네이티브 <dialog>라 포커스 가두기와 Esc 닫기가 기본으로 된다 */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none bg-transparent p-0"
    >
      <div className="mx-auto max-w-[640px] rounded-t-3xl bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 text-ink">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-black">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost min-h-10 px-4 text-[14px]">
            완료
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </dialog>
  );
}
