"use client";

import Link from "next/link";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

/**
 * Free가 전체 듣기로 오늘 듣기 몫(plans.daily_listens)을 다 써서 플레이어가 다음 소식 앞에서 멈췄을 때(2026-11-09 사용자 결정: 하루 3개 안에서).
 * 플레이어 창(ListenWidget)과 듣기 화면(ListenScreen)이 같이 쓴다. 누르면 결제 페이지로
 */
export function ListenLimit({ className = "" }: { className?: string }) {
  const { dailyListens } = useProfile();
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-mango-tint py-2 pl-3 pr-2 ${className}`}>
      <p role="status" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed">
        오늘 무료 듣기 {dailyListens}개를 다 들었어요
      </p>
      <Link href="/premium" className="btn btn-ink min-h-11 shrink-0 gap-1.5 px-3 text-[14px] no-underline">
        이어 듣기
        <PremiumBadge />
      </Link>
    </div>
  );
}
