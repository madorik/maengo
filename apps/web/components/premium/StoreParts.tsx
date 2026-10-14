"use client";

import type { Plan } from "@maengo/core/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { track } from "@/lib/analytics";
import { useInApp, useStore } from "./useStore";

// /premium 페이지의 앱 안 결제 조각. 웹 브라우저에서는 앱에서 살 수 있다는 것만 알린다(웹 결제는 없다).

function LoadFailed({ retry }: { retry: () => void }) {
  return (
    <p role="alert" className="text-[14px] font-bold text-orange">
      스토어를 불러오지 못했어요.
      <button type="button" onClick={retry} className="ml-2 underline">
        다시 불러오기
      </button>
    </p>
  );
}

function ErrorText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-2 text-[14px] font-bold text-orange">
      {text}
    </p>
  );
}

/** Premium 시작(구독) 또는 쓰고 있으면 구독 관리 */
export function PremiumBuy({ uid, plan }: { uid: string; plan: Plan }) {
  const s = useStore(uid);
  if (s.inApp === null) return <div aria-hidden="true" className="h-14" />;
  if (!s.inApp) return <p className="text-center text-[15px] font-bold text-sub">Premium은 맹고 앱에서 시작할 수 있어요.</p>;
  if (plan !== "free") {
    return (
      <div className="text-center">
        <p className="text-[16px] font-black">Premium을 쓰고 있어요</p>
        <button type="button" onClick={() => s.run("manage", (b) => b.openManage(uid), "구독 관리를 열지 못했어요.")} disabled={s.busy !== null} className="btn btn-ghost mt-3">
          구독 관리
        </button>
        <ErrorText text={s.error} />
      </div>
    );
  }
  if (s.loadFailed) return <LoadFailed retry={s.retry} />;
  if (!s.store) return <div aria-hidden="true" className="h-14 animate-pulse rounded-2xl bg-snow" />;
  const premium = s.store.premium;
  if (!premium) return <LoadFailed retry={s.retry} />;
  const buy = () => {
    track("purchase_start", { product: premium.productId });
    return s.run(
      premium.productId,
      async (b) => {
        await b.buy(uid, premium);
        track("purchase_complete", { product: premium.productId });
      },
      "결제하지 못했어요. 다시 시도해 주세요.",
    );
  };
  return (
    <div>
      <button type="button" onClick={buy} disabled={s.busy !== null} className="btn min-h-14 w-full text-[17px]">
        {s.busy === premium.productId ? "결제 중" : premium.trialDays ? `${premium.trialDays}일 무료로 시작` : `Premium 시작 · 월 ${premium.price}`}
      </button>
      <p className="mt-2 text-center text-[12px] leading-relaxed text-faint">
        {premium.trialDays
          ? `무료 체험이 끝나면 월 ${premium.price}이 자동으로 결제되고 매달 갱신돼요. 체험 중에 해지하면 결제되지 않아요. `
          : "매달 자동으로 갱신되고, 스토어의 구독 관리에서 언제든 해지할 수 있어요. "}
        <Link href="/terms" className="underline">
          이용약관
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
      <ErrorText text={s.error} />
    </div>
  );
}

/**
 * 맹고 채우기: 수량을 고르고 결제하면 서버가 그만큼 지갑에 넣는다(맹고 추가 구매를 할 수 있는 플랜만, plans 표).
 * 스토어 결제에는 수량 지정이 없어 수량마다 상품이 하나씩 있다(core/plans.ts의 MAENGO_PACKS).
 */
export function MaengoShop({ uid, canBuy, wallet }: { uid: string; canBuy: boolean; wallet: number }) {
  const s = useStore(uid);
  const [pick, setPick] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [late, setLate] = useState(false);

  // 방금 넣은 수량을 지갑 옆에 잠깐 보여 준다
  useEffect(() => {
    if (added === null) return;
    const t = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(t);
  }, [added]);

  const walletLine = (
    <p className="text-[14px] font-bold text-sub">
      지갑 <span className="font-round text-[20px] font-black tabular-nums text-ink">{wallet.toLocaleString("ko-KR")}</span>
      {added !== null && <span className="pop ml-2 font-round text-[15px] font-black text-leaf">+{added}</span>}
    </p>
  );

  if (!canBuy) {
    return (
      <>
        {walletLine}
        <Link href="#premium-buy" className="tile mt-4 flex items-center justify-between gap-3 px-4 py-3.5 no-underline hover:bg-snow">
          <span className="text-[15px] font-bold text-sub">맹고 추가 구매</span>
          <PremiumBadge />
        </Link>
      </>
    );
  }
  if (s.inApp === null) return walletLine;
  if (!s.inApp) {
    return (
      <>
        {walletLine}
        <p className="mt-3 text-[14px] text-sub">맹고 추가 구매는 맹고 앱에서 할 수 있어요.</p>
      </>
    );
  }
  if (s.loadFailed) {
    return (
      <>
        {walletLine}
        <div className="mt-3">
          <LoadFailed retry={s.retry} />
        </div>
      </>
    );
  }
  const packs = s.store?.packs ?? [];
  const chosen = packs.find((p) => p.productId === pick) ?? packs[0];

  const buy = async () => {
    if (!chosen) return;
    setLate(false);
    track("purchase_start", { product: chosen.productId });
    let synced = true;
    const ok = await s.run(
      chosen.productId,
      async (b) => {
        synced = (await b.buy(uid, chosen)).synced;
        track("purchase_complete", { product: chosen.productId });
      },
      "결제하지 못했어요. 다시 시도해 주세요.",
    );
    if (ok && synced) setAdded(chosen.maengo);
    if (ok && !synced) setLate(true);
  };

  return (
    <>
      {walletLine}
      {!s.store ? (
        <div aria-hidden="true" className="mt-4 h-40 animate-pulse rounded-2xl bg-snow" />
      ) : (
        <>
          <div role="radiogroup" aria-label="구매할 수량" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {packs.map((p) => {
              const on = p.productId === chosen?.productId;
              return (
                <button
                  key={p.productId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPick(p.productId)}
                  disabled={s.busy !== null}
                  className={`tile flex min-h-[72px] flex-col items-center justify-center gap-0.5 px-2 transition-colors ${on ? "border-mango bg-mango-tint" : "hover:bg-snow"}`}
                >
                  <span className="font-round text-[20px] font-black tabular-nums">{p.maengo}</span>
                  <span className="text-[13px] font-bold text-sub">{p.price}</span>
                </button>
              );
            })}
          </div>
          {chosen && (
            <button type="button" onClick={buy} disabled={s.busy !== null} className="btn mt-4 min-h-14 w-full text-[17px]">
              {s.busy === chosen.productId ? "결제 중" : `${chosen.maengo}맹고 구매 · ${chosen.price}`}
            </button>
          )}
          {late && <p className="mt-2 text-[14px] font-bold text-sub">결제됐어요. 맹고가 지갑에 들어오는 데 조금 걸릴 수 있어요.</p>}
          <ErrorText text={s.error} />
        </>
      )}
    </>
  );
}

/** 구매 복원(애플 심사 필수, 앱에서만) */
export function RestorePurchases({ uid }: { uid: string }) {
  const inApp = useInApp();
  if (!inApp) return null;
  return <RestoreButton uid={uid} />;
}

function RestoreButton({ uid }: { uid: string }) {
  const s = useStore(uid);
  return (
    <div className="mt-10 text-center">
      <button type="button" onClick={() => s.run("restore", (b) => b.restore(uid), "구매를 복원하지 못했어요.")} disabled={s.busy !== null} className="min-h-10 text-[13px] font-bold text-sub underline">
        {s.busy === "restore" ? "복원 중" : "구매 복원"}
      </button>
      <ErrorText text={s.error} />
    </div>
  );
}

/** 설정 > 플랜 이름 오른쪽: Premium이면 스토어의 구독 관리를 연다(앱에서만) */
export function ManageSubscription({ uid }: { uid: string }) {
  const inApp = useInApp();
  if (!inApp) return null;
  return <ManageButton uid={uid} />;
}

function ManageButton({ uid }: { uid: string }) {
  const s = useStore(uid);
  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={() => s.run("manage", (b) => b.openManage(uid), "구독 관리를 열지 못했어요.")} disabled={s.busy !== null} className="btn btn-ghost min-h-11 px-4 text-[14px]">
        구독 관리
      </button>
      <ErrorText text={s.error} />
    </div>
  );
}

