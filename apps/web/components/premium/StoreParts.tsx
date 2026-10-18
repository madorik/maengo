"use client";

import { discountPct, krwLabel } from "@maengo/core/plans";
import type { Plan } from "@maengo/core/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { track } from "@/lib/analytics";
import { appInfoOf } from "@/lib/app-client";
import { BILLING_MAIL_SUBJECT, supportMailHref } from "@/lib/site";
import { useInApp, useStore } from "./useStore";
import { AppOnlyNotice } from "./AppOnlyNotice";
import { announcePurchase } from "./PurchaseDone";
import { TRIAL_AGREE_TEXT, TrialConsent, trialChargeDay, trialNotice } from "./TrialConsent";

// /premium 페이지의 앱 안 결제 조각. 웹 브라우저에서는 앱에서 살 수 있다는 것만 알린다(웹 결제는 없다).

function LoadFailed({ retry }: { retry: () => void }) {
  return (
    <p role="alert" className="text-[14px] font-bold text-cherry">
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
    <p role="alert" className="mt-2 text-[14px] font-bold text-cherry">
      {text}
    </p>
  );
}

/** 구독 상태(서버 subscriptionView). 체험 중이면 첫 결제일을 보인다 */
export interface SubscriptionInfo {
  status: "trial" | "active" | "past_due" | "canceled";
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** 구독한 스토어(웹에서 스토어의 구독 관리 주소를 고른다) */
  store?: string;
}

/** 구독 날짜 표기(한국 날짜, '10월 25일 (토)'). 체험 줄(TrialLine)과 결제 안내 띠(BillingBanner)가 같이 쓴다 */
export const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });

/**
 * 자동 결제 금액으로 보여 줄 스토어 가격(그 나라 통화, 결제 창과 같은 값). 앱에서 스토어를 불러온 뒤에만 있고, 웹이나 불러오기 전·실패면 null.
 * plans 표 가격은 스토어 가격과 다를 수 있어 결제 금액으로 쓰지 않는다(그때는 날짜만)
 */
export function useStorePrice(uid: string): string | null {
  const s = useStore(uid);
  return (s.inApp && s.store?.premium?.price) || null;
}

/** 체험 중이면 '무료 체험 중' + 첫 결제일(해지했으면 끝나는 날). 설정 > 플랜과 /premium이 같이 쓴다. 금액은 스토어 가격을 알 때만 */
export function TrialLine({ uid, sub, className = "" }: { uid: string; sub: SubscriptionInfo | null; className?: string }) {
  const price = useStorePrice(uid);
  if (sub?.status !== "trial") return null;
  const day = dayLabel(sub.periodEnd);
  return (
    <p className={`text-[14px] font-bold text-sub ${className}`}>
      무료 체험 중 · {sub.cancelAtPeriodEnd ? `${day}에 끝나요` : price ? `${day}부터 월 ${price} 결제` : `${day}부터 자동 결제`}
    </p>
  );
}

/**
 * /premium 머리의 월 가격. 앱에서는 결제 버튼과 같은 스토어 가격(그 나라 통화), 웹(스토어 없음)이나 스토어를 불러오기 전에는 DB 가격.
 * 정가 취소선·할인율은 원화일 때만(정가는 DB plans 표의 원화 값이라 다른 통화와는 견줄 수 없다)
 */
export function PremiumPrice({ uid, priceKrw, listPriceKrw }: { uid: string; priceKrw: number; listPriceKrw: number | null }) {
  const s = useStore(uid);
  const product = s.inApp ? s.store?.premium?.pkg.product : undefined;
  const price = product?.priceString ?? krwLabel(priceKrw);
  const listed = product ? (product.currencyCode === "KRW" ? { priceKrw: product.price, listPriceKrw } : null) : { priceKrw, listPriceKrw };
  const pct = listed ? discountPct(listed) : 0;
  return (
    <>
      {pct > 0 && (
        <p className="relative mt-6 flex items-center gap-2">
          {/* 스토어 가격(₩3,800)과 같은 꼴로 */}
          <del className="font-round text-[17px] font-bold text-white/50">{product ? `₩${listPriceKrw!.toLocaleString("ko-KR")}` : krwLabel(listPriceKrw!)}</del>
          <span className="rounded-lg bg-orange px-2 py-0.5 font-round text-[13px] font-black text-white">{pct}% 할인</span>
        </p>
      )}
      <p className={`relative flex items-baseline gap-1.5 ${pct > 0 ? "mt-1.5" : "mt-6"}`}>
        <span className="font-round text-[34px] font-black leading-none tracking-[-0.02em] text-mango">{price}</span>
        <span className="text-[15px] font-bold text-white/60">/ 월</span>
      </p>
    </>
  );
}

/**
 * Premium 시작(구독). 쓰고 있으면 그렇다고만(구독 관리는 설정 > 플랜).
 * 무료 체험은 처음 구독하는 회원만(firstSub, 서버가 구독 기록으로 판단): 결제 창 전에 안내 팝업(TrialConsent)을 띄우고,
 * 확인 체크박스에 체크해야 결제한다(동의 기록은 남기지 않는다, 2026-10-18 사용자 결정).
 * 전에 구독한 적 있으면 체험 없이 바로 결제(안드로이드는 체험 없는 기본 요금제로, iOS는 애플이 체험을 한 번만 준다)
 */
export function PremiumBuy({ uid, plan, firstSub, sub }: { uid: string; plan: Plan; firstSub: boolean; sub: SubscriptionInfo | null }) {
  const s = useStore(uid);
  const [consent, setConsent] = useState<{ lines: string[]; chargeLabel: string } | null>(null);
  const [checked, setChecked] = useState(false);
  if (s.inApp === null) return <div aria-hidden="true" className="h-14" />;
  if (!s.inApp) return <AppOnlyNotice />;
  // 구독 관리는 설정 > 플랜에만 둔다(ManageSubscription)
  if (plan !== "free") {
    return (
      <div className="text-center">
        <p className="text-[16px] font-black">{sub?.status === "trial" ? "Premium 무료 체험 중이에요" : "Premium을 쓰고 있어요"}</p>
        <TrialLine uid={uid} sub={sub} className="mt-1" />
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
    setChecked(false);
    setConsent({ lines: trialNotice(trialDays, premium.price, day.label), chargeLabel: day.label });
  };

  // 확인에 체크한 뒤에만 결제 창을 띄운다
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
      <p className="mt-2 text-center text-[13px] font-medium leading-relaxed text-sub">
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
          agreeText={TRIAL_AGREE_TEXT}
          checked={checked}
          onCheck={setChecked}
          onStart={startTrial}
          onCancel={() => setConsent(null)}
        />
      )}
    </div>
  );
}

/**
 * 맹고 추가 구매: 수량을 고르고 결제하면 서버가 그만큼 지갑에 넣는다(맹고 추가 구매를 할 수 있는 플랜만, plans 표).
 * 스토어 결제에는 수량 지정이 없어 수량마다 상품이 하나씩 있다(core/plans.ts의 MAENGO_PACKS).
 * /premium과 오늘 화면의 '맹고 추가 구매하기' 시트(MoreToday)가 쓴다. onBought는 결제를 마친 뒤(시트를 닫는다)
 */
export function MaengoShop({ uid, canBuy, wallet, onBought }: { uid: string; canBuy: boolean; wallet: number; onBought?: () => void }) {
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
    if (ok) {
      onBought?.();
      announcePurchase({ kind: "maengo", amount: chosen.maengo!, late: !synced });
    }
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
          {/* 청약철회 제한 사전 고지(전자상거래법 17조 6항, 약관 6조) */}
          <p className="mt-2 text-center text-[13px] font-medium leading-relaxed text-sub">
            구매한 뒤 맹고를 써서 소식을 더 받으면 환불할 수 없어요.{" "}
            <Link href="/terms" className="underline">
              이용약관
            </Link>
          </p>
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

/**
 * 같은 맹고 계정의 구매만 복원한다(2026-10-18 사용자 결정: 구매는 계정 사이에 저절로 옮기지 않는다).
 * 스토어 계정의 구매가 다른 맹고 계정에 붙어 있으면 복원 대신 문의하기(회원 번호를 채운 메일)로 받는다
 */
function RestoreButton({ uid }: { uid: string }) {
  const s = useStore(uid);
  const [inUse, setInUse] = useState(false);
  const restore = () => {
    setInUse(false);
    void s.run(
      "restore",
      async (b) => {
        try {
          await b.restore(uid);
        } catch (e) {
          if (b.isReceiptInUse(e)) setInUse(true);
          throw e;
        }
      },
      "구매를 복원하지 못했어요.",
    );
  };
  const mail = () => {
    const app = appInfoOf(navigator.userAgent);
    return supportMailHref(BILLING_MAIL_SUBJECT, [`회원: ${uid.slice(0, 8)}`, `앱: ${app ? `${app.version} (${app.platform})` : "웹 브라우저"}`, "내용: 다른 계정에서 산 구매 복원"]);
  };
  return (
    <div className="mt-10 text-center">
      <button type="button" onClick={restore} disabled={s.busy !== null} className="min-h-10 text-[13px] font-bold text-sub underline">
        {s.busy === "restore" ? "복원 중" : "구매 복원"}
      </button>
      {inUse ? (
        <p role="alert" className="mt-2 text-[14px] font-bold text-cherry">
          다른 맹고 계정에서 산 구매라 이 계정으로 복원할 수 없어요.
          <a href={mail()} className="ml-2 underline">
            문의하기
          </a>
        </p>
      ) : (
        <ErrorText text={s.error} />
      )}
    </div>
  );
}

/** 웹에서 여는 스토어의 구독 관리 페이지(앱은 RevenueCat이 알려 주는 주소, lib/native/billing.ts openManage) */
const STORE_MANAGE_URL: Record<string, string> = {
  app_store: "https://apps.apple.com/account/subscriptions",
  play: "https://play.google.com/store/account/subscriptions",
};

/**
 * 앱 안에서 스토어의 구독 관리 화면을 연다(useStore().run: 사용자가 닫은 건 오류로 보이지 않고, 열고 나면 화면을 새로 그린다).
 * 설정 > 플랜의 구독 관리 버튼(ManageButton)과 결제 안내 띠의 글자 링크(ManageLink)가 이 하나를 같이 쓴다
 */
function useOpenManage(uid: string) {
  const s = useStore(uid);
  const open = () => void s.run("manage", (b) => b.openManage(uid), "구독 관리를 열지 못했어요.");
  return { open, busy: s.busy !== null, error: s.error };
}

/**
 * 글자 링크로 스토어의 구독 관리(해지·결제 수단)를 연다. 결제 안내 띠(체험 끝남·결제 실패, BillingBanner)가 쓴다.
 * 앱은 스토어 구독 관리 화면, 웹은 구독한 스토어의 구독 관리 페이지(스토어를 모르면 그리지 않는다). 오류 글은 링크 아래 줄(p)이라 p 안에 두지 않는다
 */
export function ManageLink({ uid, store, label, className = "" }: { uid: string; store?: string; label: string; className?: string }) {
  const inApp = useInApp();
  if (inApp === null) return null;
  if (!inApp) {
    const url = store ? STORE_MANAGE_URL[store] : undefined;
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return <InAppManageLink uid={uid} label={label} className={className} />;
}

function InAppManageLink({ uid, label, className }: { uid: string; label: string; className: string }) {
  const m = useOpenManage(uid);
  return (
    <>
      <button type="button" onClick={m.open} disabled={m.busy} className={className}>
        {label}
      </button>
      <ErrorText text={m.error} />
    </>
  );
}

/** 설정 > 플랜 이름 오른쪽: Premium이면 스토어의 구독 관리를 연다(앱에서만) */
export function ManageSubscription({ uid }: { uid: string }) {
  const inApp = useInApp();
  if (!inApp) return null;
  return <ManageButton uid={uid} />;
}

function ManageButton({ uid }: { uid: string }) {
  const m = useOpenManage(uid);
  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={m.open} disabled={m.busy} className="btn btn-ghost min-h-11 px-4 text-[14px]">
        구독 관리
      </button>
      <ErrorText text={m.error} />
    </div>
  );
}

