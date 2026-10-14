"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { IconClose } from "@/components/icons";
import { LEGAL_CHANGED_ON, LEGAL_EFFECTIVE_DATE } from "@/lib/site";

/** 이 기기에서 닫은 약관 변경(LEGAL_CHANGED_ON). 약관을 또 바꾸면 다시 보인다 */
const SEEN_KEY = "maengo_terms_seen";

const subscribe = () => () => {};
const seenHere = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === LEGAL_CHANGED_ON;
  } catch {
    return false;
  }
};

/**
 * 약관 변경 공지(결정 D4: 앱 안 공지 한 번). 바뀌기 전에 가입한 회원에게 오늘 화면 맨 위에 보인다.
 * 닫거나 약관을 열면 이 기기에서는 다시 안 보인다
 */
export function TermsNotice() {
  // 서버에서는 그리지 않고(닫았는지는 이 기기만 안다) 화면에 붙은 뒤 보인다
  const seenBefore = useSyncExternalStore(subscribe, seenHere, () => true);
  const [closed, setClosed] = useState(false);
  if (seenBefore || closed) return null;
  const seen = () => {
    setClosed(true);
    try {
      localStorage.setItem(SEEN_KEY, LEGAL_CHANGED_ON);
    } catch {}
  };
  return (
    <aside aria-label="약관 변경 안내" className="tile mb-4 flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black">이용약관과 개인정보 처리방침이 바뀌었어요</p>
        <p className="mt-1 text-[14px] font-semibold leading-relaxed text-sub">
          {LEGAL_EFFECTIVE_DATE}부터 Premium 결제, 맹고 지갑, 하루 맹고 지급 내용이 들어갔어요.
        </p>
        <p className="mt-2 text-[14px] font-extrabold text-sky">
          <Link href="/terms" onClick={seen}>
            이용약관
          </Link>
          <span className="mx-2 text-faint">·</span>
          <Link href="/privacy" onClick={seen}>
            개인정보 처리방침
          </Link>
        </p>
      </div>
      <button type="button" onClick={seen} aria-label="닫기" className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-faint">
        <IconClose className="size-5" />
      </button>
    </aside>
  );
}
