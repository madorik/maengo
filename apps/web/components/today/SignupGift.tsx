"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/Mascot";

/** 이 기기에서 본 가입 선물(받은 시각). 같은 선물은 한 번만 띄운다 */
const SEEN_KEY = "maengo_signup_gift_seen";

const subscribe = () => () => {};
const seenHere = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

/**
 * 가입 이벤트 팝업: 가입 선물 맹고를 지갑에 넣었다고 한 번 알린다(오늘 화면, 받은 지 7일 안. lib/server/wallet.ts recentSignupGift).
 * 금액은 실제로 들어간 값이다. 닫으면 이 기기에서는 다시 안 뜬다
 */
export function SignupGift({ gift }: { gift: { amount: number; at: string } }) {
  // 서버에서는 그리지 않는다(봤는지는 이 기기만 안다)
  const seen = useSyncExternalStore(subscribe, seenHere, () => gift.at);
  const [closed, setClosed] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const show = seen !== gift.at && !closed;

  useEffect(() => {
    const d = ref.current;
    if (show && d && !d.open) d.showModal();
  }, [show]);

  if (!show) return null;
  const done = () => {
    try {
      localStorage.setItem(SEEN_KEY, gift.at);
    } catch {}
    setClosed(true);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="signup-gift-title"
      aria-describedby="signup-gift-body"
      onClose={done}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(360px,calc(100vw-32px))] max-w-none overflow-visible bg-transparent p-0"
    >
      <div className="pop overflow-hidden rounded-3xl bg-paper text-center text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        <div className="keep-light flex justify-center bg-mango pb-4 pt-5">
          <Mascot mood="cheer" className="size-28" />
        </div>
        <div className="px-6 pb-6 pt-5">
          <p className="inline-block rounded-full bg-mango-tint px-3 py-1 text-[13px] font-black text-mango-deep">가입 이벤트</p>
          <p aria-hidden="true" className="mt-3 flex items-baseline justify-center gap-1 font-black">
            <span className="font-round text-[48px] leading-none tracking-[-0.02em] tabular-nums">+{gift.amount.toLocaleString("ko-KR")}</span>
            <span className="text-[24px] tracking-[-0.03em]">맹고</span>
          </p>
          <h2 id="signup-gift-title" className="mt-3 text-[20px] font-black tracking-[-0.03em]">
            가입 선물로 {gift.amount}맹고를 드렸어요
          </h2>
          <p id="signup-gift-body" className="mt-2 text-[15px] font-semibold leading-relaxed text-sub">
            하루 소식을 다 받은 뒤에도 1맹고로 소식을 하나 더 받을 수 있어요. 지갑의 맹고는 사라지지 않아요.
          </p>
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="btn mt-6 min-h-14 w-full text-[17px]">
            좋아요
          </button>
        </div>
      </div>
    </dialog>
  );
}
