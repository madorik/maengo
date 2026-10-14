"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { receiveMoreAction } from "@/app/actions";
import { IconPlus } from "@/components/icons";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";

const ERRORS = {
  no_more: "최근 한 달 동안 관심사에 맞는 새 소식이 없어요. 관심사를 넓혀 보세요.",
  blocked: "지금은 요청량이 많아 새 소식을 만들 수 없어요. 조금 뒤에 다시 시도해주세요.",
  no_balance: "맹고가 모자라요.",
  busy: "다시 눌러 주세요.",
  no_feed: "오늘 맹고를 먼저 받아 주세요.",
  failed: "더 받지 못했어요. 다시 눌러 주세요.",
} as const;

/**
 * 오늘 목록 아래 '하나 더 받기'. 하루 맹고(플랜의 하루 소식 수)를 넘으면 지갑에서 1맹고를 쓴다.
 * 골라 둔 소식이 있으면 그것부터, 없으면 서버가 요약된 소식에서 하나 더 고른다. 붙으면 액션이 오늘 화면을 새로 그린다.
 */
export function MoreToday({ cost, kept }: { cost: number; kept: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  // 1.5초 넘게 걸리면 지금 새로 요약하는 중이다(최근 한 달 묶음에서 만들기, 10~20초)
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(t);
  }, [pending]);
  // 하루 맹고를 다 받았고 지갑도 비었으면 '하나 더 받기' 대신 '맹고 추가 구매하기'(Free는 구매가 Premium 기능이라 Premium 안내로)
  const short = cost > kept;
  const buy = useProfile().canBuyMaengo ? "/premium#maengo" : "/premium";

  const more = () => {
    setSlow(false);
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
  };

  return (
    <div className="mt-4">
      {short ? (
        <Link href={buy} className="btn w-full">
          맹고 추가 구매하기
        </Link>
      ) : (
        <button type="button" onClick={more} disabled={pending} className="btn w-full">
          <IconPlus className="size-5" />
          {pending ? (slow ? "새 맹고 만드는 중" : "받는 중") : "하나 더 받기"}
          {cost > 0 && <span className="font-round text-[14px] opacity-80">{cost}맹고</span>}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px] font-bold text-orange">
          {ERRORS[error]}
          {error === "no_balance" && (
            <Link href={buy} className="ml-2 underline">
              맹고 추가 구매하기
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
