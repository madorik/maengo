"use client";

import Link from "next/link";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

/**
 * Free가 들을 수 없는 소식 앞에서 플레이어가 멈췄을 때. 오늘 브리핑은 Free도 제한 없이 들어서(2026-11-26) 여기 닿는 건
 * 지난 소식(보관함)을 하루 몫(plans.daily_listens)만큼 다 들은 뒤다(전엔 11-09부터 오늘 브리핑도 하루 3개 안에서).
 * 플레이어 창(ListenWidget)과 듣기 화면(ListenScreen)이 같이 쓴다. 누르면 결제 페이지로
 */
export function ListenLimit({ className = "" }: { className?: string }) {
  const { dailyListens } = useProfile();
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-snow py-2 pl-3 pr-2 ${className}`}>
      <p role="status" className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed">
        오늘 무료로 들을 지난 소식 {dailyListens}개를 다 들었어요
      </p>
      <Link href="/premium" className="btn btn-ink min-h-11 shrink-0 gap-1.5 px-3 text-[14px] no-underline">
        이어 듣기
        <PremiumBadge />
      </Link>
    </div>
  );
}
