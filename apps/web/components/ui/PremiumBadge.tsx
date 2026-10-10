import { Crown } from "@/components/icons";

/** 👑 Premium 배지. Free 계정에서 Premium 기능(듣기 등) 버튼 옆에 붙인다 */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md bg-mango px-1.5 py-0.5 text-[11px] font-black text-ink ${className}`}>
      <Crown className="size-3.5" />
      Premium
    </span>
  );
}
