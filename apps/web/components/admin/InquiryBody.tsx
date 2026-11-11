"use client";

import { useState, useTransition } from "react";
import { translateInquiryAction } from "@/app/admin/inquiry-actions";
import { looksForeign } from "@/lib/inquiry";

/**
 * 관리자 > 문의의 문의 내용. 한국어가 아닌 문의면 아래에 '한국어로 번역'(2026-11-11 사용자: 영어 문의가 많다).
 * 번역은 원문 아래에 따로 보이고(원문은 그대로), 접었다 펼 수 있다. 같은 문의는 서버가 기억해 다시 부르지 않는다
 */
export function InquiryBody({ id, body }: { id: number; body: string }) {
  const foreign = looksForeign(body);
  const [ko, setKo] = useState<string | null>(null);
  const [shown, setShown] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const onClick = () => {
    if (ko) return setShown((v) => !v);
    start(async () => {
      setError(null);
      const res = await translateInquiryAction(id);
      if (res.ok) setKo(res.text);
      else setError(res.error);
    });
  };

  return (
    <>
      <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-snow px-3 py-2.5 text-[14px] font-medium leading-relaxed">{body}</p>
      {foreign && (
        <div className="mt-2">
          {ko && shown && (
            <div className="rounded-xl border-2 border-line px-3 py-2.5">
              <p className="text-[12px] font-extrabold text-sub">한국어 번역(AI)</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[14px] font-medium leading-relaxed">{ko}</p>
            </div>
          )}
          <button type="button" onClick={onClick} disabled={busy} aria-expanded={ko ? shown : undefined} className="mt-1 min-h-10 text-[13px] font-bold text-sub underline disabled:no-underline">
            {busy ? "번역하는 중…" : ko ? (shown ? "번역 접기" : "번역 보기") : "한국어로 번역"}
          </button>
          <p aria-live="polite" className="text-[13px] font-bold text-cherry empty:hidden">
            {error}
          </p>
        </div>
      )}
    </>
  );
}
