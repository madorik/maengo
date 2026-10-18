"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/Mascot";
import { Confetti } from "@/components/ui/Confetti";

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
 * 가입 축하 이벤트 팝업: 가입 선물 맹고를 지갑에 넣었다고 한 번 알린다
 * (오늘 화면, 최근 7일 안에 가입한 회원. lib/server/wallet.ts recentSignupGift).
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
      onClose={done}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(340px,calc(100vw-40px))] max-w-none overflow-visible bg-transparent p-0"
    >
      <div className="pop overflow-hidden rounded-[28px] bg-paper text-center text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        {/* 축하 영역: 연한 망고색 위에 색종이, 마스코트와 맹고 동전 */}
        <div aria-hidden="true" className="keep-light relative h-[168px] bg-[#FFF4D6]">
          <Confetti />
          <div className="absolute left-1/2 top-6 -translate-x-1/2">
            <Mascot mood="cheer" className="size-[120px]" />
            <span
              className="pop absolute -bottom-1 -right-9 flex size-[62px] rotate-[-10deg] flex-col items-center justify-center rounded-full border-[3px] border-[#E09A12] bg-[#FFC23D] text-[#1F2340] shadow-[0_5px_0_#E09A12]"
              style={{ animationDelay: "220ms" }}
            >
              <span className="font-round text-[21px] font-black leading-none tabular-nums">+{gift.amount}</span>
              <span className="mt-0.5 text-[11px] font-black leading-none">맹고</span>
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <h2 id="signup-gift-title" className="text-[20px] font-black leading-[1.45] tracking-[-0.03em]">
            가입 축하 이벤트로
            <br />
            {gift.amount}맹고를 지갑에 넣어드렸어요~!
          </h2>
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="btn mt-6 min-h-[52px] w-full text-[17px]">
            고마워요!
          </button>
        </div>
      </div>
    </dialog>
  );
}
