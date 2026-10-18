"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Crown } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { Confetti } from "@/components/ui/Confetti";

// 결제를 마치면 띄우는 축하 팝업(가입 축하 팝업 SignupGift와 같은 모양).
// 결제가 끝나면 화면이 새로 그려지며 구매 버튼 자리가 바뀌므로(Premium → 구독 관리), 버튼이 아니라 /premium 화면에 둔 PurchaseDoneHost가 띄운다.
// 띄울 내용은 컴포넌트 밖(이 모듈)에 둔다: 결제 직후 router.refresh로 화면이 다시 붙으면 컴포넌트 상태가 사라져 팝업이 바로 닫히는 일이 있었다.

export type PurchaseDoneDetail =
  | { kind: "premium"; trialDays: number | null }
  /** late: 결제는 됐지만 서버가 아직 지갑에 못 넣음(웹훅이 곧 넣는다) */
  | { kind: "maengo"; amount: number; late: boolean };

let pending: PurchaseDoneDetail | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** 결제 성공을 알린다(StoreParts의 PremiumBuy·MaengoShop). 닫을 때까지 남는다 */
export function announcePurchase(detail: PurchaseDoneDetail) {
  pending = detail;
  emit();
}

function dismiss() {
  pending = null;
  emit();
}

function copy(d: PurchaseDoneDetail): { title: [string, string]; body: string } {
  if (d.kind === "premium") {
    return d.trialDays
      ? { title: [`${d.trialDays}일 무료 체험을`, "시작했어요~!"], body: "체험이 끝나기 전에 해지하면 결제되지 않아요." }
      : { title: ["맹고 Premium을", "시작했어요~!"], body: "음성 듣기, 관심사 추가, 내 관심 링크를 바로 쓸 수 있어요." };
  }
  return d.late
    ? { title: ["결제가 끝났어요", `${d.amount}맹고가 곧 들어와요`], body: "맹고가 지갑에 들어오는 데 조금 걸릴 수 있어요." }
    : { title: [`${d.amount}맹고를`, "지갑에 넣었어요~!"], body: "1맹고로 오늘 소식을 하나 더 받을 수 있어요." };
}

export function PurchaseDoneHost() {
  const detail = useSyncExternalStore(subscribe, () => pending, () => null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (detail && d && !d.open) d.showModal();
  }, [detail]);

  if (!detail) return null;
  const { title, body } = copy(detail);

  return (
    <dialog
      ref={ref}
      aria-labelledby="purchase-done-title"
      aria-describedby="purchase-done-body"
      // 화면이 다시 붙으며 빠진 창의 close는 무시한다(새로 붙은 쪽이 다시 띄운다)
      onClose={(e) => {
        if (e.currentTarget.isConnected) dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(340px,calc(100vw-40px))] max-w-none overflow-visible bg-transparent p-0"
    >
      <div className="pop overflow-hidden rounded-[28px] bg-paper text-center text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        {/* 축하 영역: 연한 망고색 위에 색종이, 마스코트와 왕관(구독)·맹고 동전(묶음) */}
        <div aria-hidden="true" className="keep-light relative h-[168px] bg-[#FFF4D6]">
          <Confetti />
          <div className="absolute left-1/2 top-6 -translate-x-1/2">
            <Mascot mood="cheer" className="size-[120px]" />
            <span
              className="pop absolute -bottom-1 -right-9 flex size-[62px] rotate-[-10deg] flex-col items-center justify-center rounded-full border-[3px] border-[#E09A12] bg-[#FFC23D] text-[#1F2340] shadow-[0_5px_0_#E09A12]"
              style={{ animationDelay: "220ms" }}
            >
              {detail.kind === "premium" ? (
                <Crown className="size-8" />
              ) : (
                <>
                  <span className="font-round text-[21px] font-black leading-none tabular-nums">+{detail.amount}</span>
                  <span className="mt-0.5 text-[11px] font-black leading-none">맹고</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <h2 id="purchase-done-title" className="text-[20px] font-black leading-[1.45] tracking-[-0.03em]">
            {title[0]}
            <br />
            {title[1]}
          </h2>
          <p id="purchase-done-body" className="mt-2 text-[15px] font-semibold leading-relaxed text-sub">
            {body}
          </p>
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="btn mt-6 min-h-[52px] w-full text-[17px]">
            좋아요!
          </button>
        </div>
      </div>
    </dialog>
  );
}
