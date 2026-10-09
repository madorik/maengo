"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="grid grid-cols-3 gap-2 border-t-2 border-line bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
      {NAV.map(({ href, label, Icon }) => {
        const current = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[12px] font-extrabold no-underline ${
              current ? "border-mango bg-mango-tint text-mango-deep" : "border-transparent text-sub"
            }`}
          >
            <Icon className="size-7" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
