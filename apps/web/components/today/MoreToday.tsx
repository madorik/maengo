"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { receiveMoreAction } from "@/app/actions";
import { IconPlus } from "@/components/icons";
import { PurchaseDoneHost } from "@/components/premium/PurchaseDone";
import { MaengoShop } from "@/components/premium/StoreParts";
import { useInApp } from "@/components/premium/useStore";
import { useProfile } from "@/components/providers/ProfileProvider";
import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/analytics";

const ERRORS = {
  no_more: "최근 한 달 동안 관심사에 맞는 새 소식이 없어요.",
  blocked: "지금은 요청량이 많아 새 소식을 만들 수 없어요. 조금 뒤에 다시 시도해주세요.",
  no_balance: "맹고가 모자라요.",
  busy: "다시 눌러 주세요.",
  no_feed: "오늘 소식을 먼저 받아 주세요.",
  failed: "더 받지 못했어요. 다시 눌러 주세요.",
} as const;

/**
 * 오늘 목록 아래 '하나 더 받기'. 하루 맹고(플랜의 하루 소식 수)를 넘으면 지갑에서 1맹고를 쓴다(잔액은 오늘 화면에 보이지 않는다).
 * 골라 둔 소식이 있으면 그것부터, 없으면 서버가 요약된 소식에서 하나 더 고른다. 붙으면 액션이 오늘 화면을 새로 그린다.
 * 지갑이 비면 '맹고 추가 구매하기': 앱은 이 자리에서 묶음 결제 시트(MaengoShop)를 열고, 웹은 결제 화면(/premium, 웹에는 결제가 없다)으로.
 * onExpect·onSettle: 누르기 직전·끝났을 때 오늘 목록에 알린다(새로 붙은 소식으로 스크롤하고 짚는다, arrival.ts)
 */
export function MoreToday({
  cost,
  kept,
  onExpect,
  onSettle,
}: {
  cost: number;
  kept: number;
  /** keyboard = 키보드·화면 읽기 도구로 눌렀는지(새 소식으로 초점을 옮긴다) */
  onExpect?: (keyboard: boolean) => void;
  onSettle?: (ok: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const [shop, setShop] = useState(false);
  /** 시트를 한 번 열었는지. 처음 열 때 그려 스토어 상품을 불러오고, 그 뒤에는 남겨 두어 닫을 때 내려가는 움직임이 끝까지 보이게 한다 */
  const [shopMounted, setShopMounted] = useState(false);
  // 1.5초 넘게 걸리면 지금 새로 요약하는 중이다(최근 한 달 묶음에서 만들기, 10~20초)
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(t);
  }, [pending]);
  const profile = useProfile();
  const inApp = useInApp();
  // 하루 맹고를 다 받았고 지갑도 비었으면 '하나 더 받기' 대신 '맹고 추가 구매하기'(맹고를 살 수 없는 플랜은 Premium 안내로)
  const short = cost > kept;
  const inAppShop = profile.canBuyMaengo && inApp === true;
  const buyHref = profile.canBuyMaengo ? "/premium#maengo" : "/premium";
  const buyLabel = "맹고 추가 구매하기";

  const more = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSlow(false);
    // 키보드(Enter·Space)로 누른 클릭은 detail이 0이다
    onExpect?.(e.detail === 0);
    start(async () => {
      setError(null);
      try {
        const res = await receiveMoreAction();
        onSettle?.(res.ok);
        if (!res.ok) return setError(res.error);
        track("more_receive", { charged: res.charged });
      } catch {
        onSettle?.(false);
        setError("failed");
      }
    });
  };

  const openShop = () => {
    setError(null);
    setShopMounted(true);
    setShop(true);
  };

  return (
    <div className="mt-4">
      {short ? (
        inAppShop ? (
          <button type="button" onClick={openShop} className="btn w-full">
            {buyLabel}
          </button>
        ) : (
          <Link href={buyHref} className="btn w-full">
            {buyLabel}
          </Link>
        )
      ) : (
        <button type="button" onClick={more} disabled={pending} className="btn w-full">
          <IconPlus className="size-5" />
          {pending ? (slow ? "새 소식 만드는 중" : "받는 중") : "하나 더 받기"}
          {cost > 0 && <span className="font-round text-[14px] opacity-80">{cost}맹고</span>}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 px-1 text-[14px] font-bold text-cherry">
          {ERRORS[error]}
          {error === "no_more" && (
            <Link href="/settings#topics" className="ml-2 underline">
              관심사 넓히기
            </Link>
          )}
          {error === "no_balance" &&
            (inAppShop ? (
              <button type="button" onClick={openShop} className="ml-2 underline">
                {buyLabel}
              </button>
            ) : (
              <Link href={buyHref} className="ml-2 underline">
                {buyLabel}
              </Link>
            ))}
        </p>
      )}
      {/* 처음 열 때 스토어 상품을 불러온다. 결제를 마치면 내려 닫고 축하 팝업, 지갑은 결제 뒤 화면을 새로 그리며 늘어난다 */}
      {shopMounted && (
        <Sheet title="맹고 추가 구매" open={shop} onClose={() => setShop(false)}>
          <MaengoShop uid={profile.id} canBuy wallet={kept} onBought={() => setShop(false)} />
        </Sheet>
      )}
      {inAppShop && <PurchaseDoneHost />}
    </div>
  );
}
