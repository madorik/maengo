"use client";

import type { Plan } from "@maengo/core/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { useInApp, useStore } from "./useStore";
import { AppOnlyNotice } from "./AppOnlyNotice";
import { announcePurchase } from "./PurchaseDone";
import { TrialConsent, trialAgreeText, trialChargeDay, trialNotice } from "./TrialConsent";

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

/** 구독 상태(서버 subscriptionView). 체험 중이면 첫 결제일을 보인다 */
export interface SubscriptionInfo {
  status: "trial" | "active" | "past_due" | "canceled";
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

/** 체험 중이면 '무료 체험 중' + 첫 결제일(해지했으면 끝나는 날). 설정 > 플랜과 /premium이 같이 쓴다 */
export function TrialLine({ sub, priceKrw, className = "" }: { sub: SubscriptionInfo | null; priceKrw: number; className?: string }) {
  if (sub?.status !== "trial") return null;
  return (
    <p className={`text-[14px] font-bold text-sub ${className}`}>
      무료 체험 중 ·{" "}
      {sub.cancelAtPeriodEnd ? `${dayLabel(sub.periodEnd)}에 끝나요` : `${dayLabel(sub.periodEnd)}부터 월 ${priceKrw.toLocaleString("ko-KR")}원 결제`}
    </p>
  );
}

/**
 * Premium 시작(구독). 쓰고 있으면 그렇다고만(구독 관리는 설정 > 플랜).
 * 무료 체험은 처음 구독하는 회원만(firstSub, 서버가 구독 기록으로 판단): 결제 창 전에 동의 팝업(TrialConsent)을 띄우고,
 * 동의 체크박스에 체크하면 그때 동의를 남긴다(체크돼 있어야 결제).
 * 전에 구독한 적 있으면 체험 없이 바로 결제(안드로이드는 체험 없는 기본 요금제로, iOS는 애플이 체험을 한 번만 준다)
 */
export function PremiumBuy({ uid, plan, firstSub, sub, priceKrw }: { uid: string; plan: Plan; firstSub: boolean; sub: SubscriptionInfo | null; priceKrw: number }) {
  const s = useStore(uid);
  const [consent, setConsent] = useState<{ lines: string[]; agreeText: string; chargeOn: string; chargeLabel: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  if (s.inApp === null) return <div aria-hidden="true" className="h-14" />;
  if (!s.inApp) return <AppOnlyNotice />;
  // 구독 관리는 설정 > 플랜에만 둔다(ManageSubscription)
  if (plan !== "free") {
    return (
      <div className="text-center">
        <p className="text-[16px] font-black">{sub?.status === "trial" ? "Premium 무료 체험 중이에요" : "Premium을 쓰고 있어요"}</p>
        <TrialLine sub={sub} priceKrw={priceKrw} className="mt-1" />
      </div>
    );
  }
  if (s.loadFailed) return <LoadFailed retry={s.retry} />;
  if (!s.store) return <div aria-hidden="true" className="h-14 animate-pulse rounded-2xl bg-snow" />;
  const premium = s.store.premium;
  if (!premium) return <LoadFailed retry={s.retry} />;
  // 스토어가 체험을 줄 수 있고(0원 첫 기간, iOS는 자격 확인) 우리 회원이 처음 구독할 때만
  const trialDays = firstSub ? premium.trialDays : null;

  const purchase = async (trial: { chargeLabel: string } | null) => {
    track("purchase_start", { product: premium.productId });
    const ok = await s.run(
      premium.productId,
      async (b) => {
        await b.buy(uid, premium, { noTrial: !firstSub });
        track("purchase_complete", { product: premium.productId });
      },
      "결제하지 못했어요. 다시 시도해 주세요.",
    );
    if (ok) announcePurchase({ kind: "premium", trialDays: trial ? trialDays : null, chargeLabel: trial?.chargeLabel ?? null, price: premium.price });
  };

  const start = () => {
    if (!trialDays) return void purchase(null);
    const day = trialChargeDay(trialDays);
    setConsentError(null);
    setChecked(false);
    setConsent({ lines: trialNotice(trialDays, premium.price, day.label), agreeText: trialAgreeText(premium.price), chargeOn: day.iso, chargeLabel: day.label });
  };

  // 체크하면 그 자리에서 동의를 남긴다(남겨야 체크된다). 체크를 풀면 결제만 막는다
  const check = async (on: boolean) => {
    if (!consent || !trialDays) return;
    setConsentError(null);
    if (!on) return setChecked(false);
    setRecording(true);
    const res = await fetch(withBase("/api/billing/trial-consent"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: premium.productId,
        trialDays,
        price: premium.price,
        chargeOn: consent.chargeOn,
        notice: [...consent.lines, `[동의] ${consent.agreeText}`].join("\n"),
      }),
    }).catch(() => null);
    setRecording(false);
    if (res?.ok) return setChecked(true);
    setConsentError(res?.status === 409 ? "전에 구독한 적이 있어 무료 체험을 받을 수 없어요. 새로고침하면 바로 시작할 수 있어요." : "동의를 저장하지 못했어요. 다시 시도해 주세요.");
  };

  // 동의가 남은(체크된) 뒤에만 결제 창을 띄운다
  const startTrial = async () => {
    if (!consent || !checked) return;
    const chargeLabel = consent.chargeLabel;
    setConsent(null);
    await purchase({ chargeLabel });
  };

  return (
    <div>
      <button type="button" onClick={start} disabled={s.busy !== null} className="btn min-h-14 w-full text-[17px]">
        {s.busy === premium.productId ? "결제 중" : trialDays ? `${trialDays}일 무료로 시작` : `Premium 시작 · 월 ${premium.price}`}
      </button>
      <p className="mt-2 text-center text-[12px] leading-relaxed text-faint">
        {trialDays
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
      {trialDays && (
        <TrialConsent
          open={consent !== null}
          trialDays={trialDays}
          lines={consent?.lines ?? []}
          agreeText={consent?.agreeText ?? ""}
          checked={checked}
          recording={recording}
          error={consentError}
          onCheck={check}
          onStart={startTrial}
          onCancel={() => {
            if (!recording) setConsent(null);
          }}
        />
      )}
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

  // 방금 넣은 수량을 지갑 옆에 잠깐 보여 준다
  useEffect(() => {
    if (added === null) return;
    const t = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(t);
  }, [added]);

  const walletLine = (
    <p className="text-[14px] font-bold text-sub">
      {/* 지갑 맹고 n개(설정 지갑 칸과 같은 모양) */}
      지갑 <span className="ml-1">맹고</span> <span className="font-round text-[20px] font-black tabular-nums text-ink">{wallet.toLocaleString("ko-KR")}</span>개
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
    if (ok) announcePurchase({ kind: "maengo", amount: chosen.maengo!, late: !synced });
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

