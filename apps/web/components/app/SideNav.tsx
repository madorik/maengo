"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MangoIcon } from "@/components/MangoIcon";
import { NAV } from "./nav";
import { StatChips } from "./StatChips";

/** 데스크톱 왼쪽 메뉴 */
export function SideNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 hidden h-dvh border-r-2 border-line px-4 py-7 lg:block">
      <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 px-3 no-underline">
        <MangoIcon className="size-9" />
        <span className="text-[28px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
      </Link>
      <nav aria-label="주 메뉴" className="mt-8 flex flex-col gap-2">
        {NAV.map(({ href, label, Icon }) => {
          const current = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-[52px] items-center gap-4 rounded-xl border-2 px-3 text-[16px] font-extrabold no-underline ${
                current ? "border-mango bg-mango-tint text-mango-deep" : "border-transparent text-sub hover:bg-snow"
              }`}
            >
              <Icon className="size-7" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t-2 border-line px-1 pt-5">
        <StatChips />
      </div>
    </div>
  );
}
