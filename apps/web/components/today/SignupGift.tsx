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

/** 위쪽 축하 영역에 흩뿌린 색종이(위치 %, 기울기, 크기 px, 둥근지) */
const CONFETTI: { x: number; y: number; r: number; w: number; h: number; c: string; dot?: boolean }[] = [
  { x: 9, y: 22, r: -24, w: 7, h: 14, c: "#34B36A" },
  { x: 18, y: 64, r: 0, w: 9, h: 9, c: "#1A8FE0", dot: true },
  { x: 25, y: 34, r: 28, w: 6, h: 12, c: "#FF6F61" },
  { x: 33, y: 12, r: 0, w: 7, h: 7, c: "#FF9F2E", dot: true },
  { x: 70, y: 14, r: -12, w: 8, h: 8, c: "#FF6F61", dot: true },
  { x: 78, y: 40, r: 38, w: 7, h: 14, c: "#1A8FE0" },
  { x: 88, y: 20, r: 0, w: 6, h: 6, c: "#34B36A", dot: true },
  { x: 90, y: 66, r: -30, w: 6, h: 12, c: "#FF9F2E" },
  { x: 12, y: 86, r: 50, w: 6, h: 11, c: "#FF9F2E" },
  { x: 84, y: 88, r: 0, w: 8, h: 8, c: "#34B36A", dot: true },
];

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
      aria-describedby="signup-gift-body"
      onClose={done}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(340px,calc(100vw-40px))] max-w-none overflow-visible bg-transparent p-0"
    >
      <div className="pop overflow-hidden rounded-[28px] bg-paper text-center text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        {/* 축하 영역: 연한 망고색 위에 색종이, 마스코트와 맹고 동전 */}
        <div aria-hidden="true" className="keep-light relative h-[168px] bg-[#FFF4D6]">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className={`absolute ${p.dot ? "rounded-full" : "rounded-[2px]"}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.w, height: p.h, background: p.c, transform: `rotate(${p.r}deg)` }}
            />
          ))}
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
          <p id="signup-gift-body" className="mt-2 text-[15px] font-semibold leading-relaxed text-sub">
            맹고를 소모해서 소식을 추가로 받을 수 있어요~
          </p>
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="btn mt-6 min-h-[52px] w-full text-[17px]">
            고마워요!
          </button>
        </div>
      </div>
    </dialog>
  );
}
