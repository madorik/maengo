"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * 보관함 분야 탭(2026-11-26 시안): '모든 분야' + 받은 소식에 있는 분야들. 켜진 탭은 굵은 진한 글자 + 아래 망고 노랑 3px 줄, 아래에 옅은 구분선.
 * 분야가 많아 옆으로 밀어야 보이므로, 주소가 바뀌어 켜진 탭이 달라지면 그 탭이 보이는 자리로 옮겨 둔다.
 * 구분선은 탭 줄의 안쪽 그림자라서 켜진 탭의 3px 줄이 그 위를 덮는다
 */
export function SectionTabs({ tabs }: { tabs: { href: string; label: string; on: boolean; count: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const active = tabs.find((t) => t.on)?.label;
  useEffect(() => {
    const el = box.current;
    const on = el?.querySelector<HTMLElement>("[aria-current]");
    if (el && on) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [active]);
  return (
    <nav aria-label="분야">
      <div ref={box} className="relative -mx-5 mt-1.5 flex gap-5 overflow-x-auto px-5 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.on ? "page" : undefined}
            className={`inline-flex h-[46px] shrink-0 items-center border-b-[3px] text-[15px] no-underline ${
              t.on ? "border-mango font-extrabold text-ink" : "border-transparent font-semibold text-sub"
            }`}
          >
            {t.label}
            <span className="sr-only">{` ${t.count}개`}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
