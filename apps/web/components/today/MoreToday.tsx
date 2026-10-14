"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { receiveMoreAction } from "@/app/actions";
import { IconPlus } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";

const ERRORS = {
  no_more: "지금은 더 받을 소식이 없어요. 새 소식이 모이면 다시 눌러 주세요.",
  no_balance: "맹고가 모자라요.",
  busy: "다시 눌러 주세요.",
  no_feed: "오늘 맹고를 먼저 받아 주세요.",
  failed: "더 받지 못했어요. 다시 눌러 주세요.",
} as const;

/**
 * 오늘 목록 아래 '하나 더 받기'. 하루 맹고(플랜의 하루 소식 수)를 넘으면 지갑에서 1맹고를 쓴다.
 * 골라 둔 소식이 있으면 그것부터, 없으면 서버가 요약된 소식에서 하나 더 고른다. 붙으면 액션이 오늘 화면을 새로 그린다.
 */
export function MoreToday({ cost, kept, hidden }: { cost: number; kept: number; hidden: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const short = cost > kept;
  // 맹고 추가 구매를 못 하는 플랜(Free)은 Premium 안내로 보낸다
  const canBuy = useProfile().canBuyMaengo;
  const fill = canBuy ? { href: "/premium#maengo", label: "맹고 채우기" } : { href: "/premium", label: "Premium 알아보기" };

  const more = () =>
    start(async () => {
      setError(null);
      try {
        const res = await receiveMoreAction();
        if (!res.ok) return setError(res.error);
        track("more_receive", { charged: res.charged });
      } catch {
        setError("failed");
      }
    });

  return (
    <div className="mt-4">
      <div className="tile flex flex-col gap-4 border-dashed p-5 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <Mascot mood="happy" className="size-14 shrink-0" />
          <div>
            <p className="text-[16px] font-black">{hidden > 0 ? `골라 둔 소식이 ${hidden}개 더 있어요` : "오늘 맹고 더 받기"}</p>
            <p className="mt-0.5 text-[14px] font-semibold text-sub">
              지갑 <span className="font-round font-black tabular-nums text-ink">{kept.toLocaleString("ko-KR")}</span>
            </p>
          </div>
        </div>
        {short ? (
          <Link href={fill.href} className="btn shrink-0">
            {fill.label}
          </Link>
        ) : (
          <button type="button" onClick={more} disabled={pending} className="btn shrink-0">
            <IconPlus className="size-5" />
            {pending ? "받는 중" : "하나 더 받기"}
            {cost > 0 && <span className="font-round text-[14px] opacity-80">{cost}맹고</span>}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px] font-bold text-orange">
          {ERRORS[error]}
          {error === "no_balance" && (
            <Link href={fill.href} className="ml-2 underline">
              {fill.label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
