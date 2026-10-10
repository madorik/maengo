import { BETA } from "@/lib/site";

/** 로고 옆 Beta 표시. 베타 기간에만 보인다(lib/site.ts의 BETA) */
export function BetaBadge({ className = "" }: { className?: string }) {
  if (!BETA) return null;
  return <span className={`rounded-md bg-sky-tint px-1.5 py-0.5 text-[11px] font-black leading-none tracking-normal text-sky-dark ${className}`}>Beta</span>;
}
