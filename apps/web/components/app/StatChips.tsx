"use client";

import Link from "next/link";
import { Bolt } from "@/components/icons";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";

/** 오늘 XP · 플랜. 모바일 위쪽 막대와 데스크톱 왼쪽 메뉴에 쓴다 */
export function StatChips() {
  const { game } = useToday();
  const profile = useProfile();
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 font-round text-[18px] font-black text-mango-deep" title="오늘 읽고 들은 만큼 쌓여요">
        <Bolt />
        {game.xp}
        <span className="sr-only">XP</span>
      </span>
      {profile.plan === "free" ? (
        <Link href="/settings#plan" className="ml-1 rounded-xl border-2 border-mango px-2.5 py-1 text-[13px] font-extrabold text-mango-deep no-underline">
          플러스
        </Link>
      ) : (
        <span className="ml-1 rounded-xl bg-sky px-2.5 py-1 text-[13px] font-extrabold text-white">
          {profile.plan === "trial" ? `체험 ${profile.trialDaysLeft}일` : "PLUS"}
        </span>
      )}
    </div>
  );
}
