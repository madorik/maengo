"use client";

import { useRouter } from "next/navigation";
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
 * 가입 환영 팝업: 한 번 알린다(오늘 화면, 최근 7일 안에 가입한 회원. lib/server/wallet.ts recentSignupGift로 가입 시각을 본다).
 * 2026-11-12 맹고(재화)를 걷어 내서 '맹고를 지갑에 넣었다'는 말과 동전은 뺐다. 닫으면 이 기기에서는 다시 안 뜬다.
 * 버튼 '무료로 시작해보기'는 요금제(/premium?trial=1)로 보내 7일 무료 체험 안내를 띄운다. 바깥을 누르면 그냥 닫힌다.
 * 기능 안내(FeatureTour)를 본 뒤에 오늘 화면에서 뜬다(TodayList)
 */
export function SignupGift({ gift }: { gift: { amount: number; at: string } }) {
  // 서버에서는 그리지 않는다(봤는지는 이 기기만 안다)
  const seen = useSyncExternalStore(subscribe, seenHere, () => gift.at);
  const [closed, setClosed] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
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
        {/* 축하 영역: 연한 망고색 위에 색종이와 마스코트 */}
        <div aria-hidden="true" className="keep-light relative h-[168px] bg-[#FFF4D6]">
          <Confetti />
          <div className="absolute left-1/2 top-6 -translate-x-1/2">
            <Mascot mood="cheer" className="size-[120px]" />
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <h2 id="signup-gift-title" className="text-[20px] font-black leading-[1.45] tracking-[-0.03em]">
            가입을 환영해요!
            <br />
            Premium을 7일 동안 무료로 써 보세요
          </h2>
          {/* Premium 유도(2026-11-06): 요금제로 가서 무료 체험 안내 팝업을 바로 띄운다(PremiumBuy autoTrial) */}
          <button
            type="button"
            autoFocus
            onClick={() => {
              ref.current?.close();
              router.push("/premium?trial=1");
            }}
            className="btn mt-6 min-h-[52px] w-full text-[17px]"
          >
            무료로 시작해보기
          </button>
        </div>
      </div>
    </dialog>
  );
}
