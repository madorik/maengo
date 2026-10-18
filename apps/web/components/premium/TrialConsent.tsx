"use client";

import { useEffect, useRef } from "react";

// 첫 구독 무료 체험 동의 팝업(2026-10-18 사용자 결정). '동의하고 무료로 시작'을 누르면 부른 쪽이 동의를 서버에 남긴 뒤(/api/billing/trial-consent)
// 결제 창을 띄운다. 보여 준 안내(trialNotice)를 그대로 기록한다.

const TZ = "Asia/Seoul";

/** 체험이 끝나 첫 결제가 되는 날(한국 날짜): 저장용 YYYY-MM-DD와 화면용 '10월 25일 (토)' */
export function trialChargeDay(trialDays: number, now = new Date()): { iso: string; label: string } {
  const d = new Date(now.getTime() + trialDays * 86_400_000);
  return {
    iso: d.toLocaleDateString("en-CA", { timeZone: TZ }),
    label: d.toLocaleDateString("ko-KR", { timeZone: TZ, month: "long", day: "numeric", weekday: "short" }),
  };
}

/** 팝업에 보여 주고 그대로 기록하는 안내 */
export function trialNotice(trialDays: number, price: string, chargeLabel: string): string[] {
  return [
    `오늘부터 ${trialDays}일 동안 Premium을 무료로 써요.`,
    `체험이 끝나는 ${chargeLabel}에 월 ${price}이 자동으로 결제되고, 그 뒤로 매달 같은 날 갱신돼요.`,
    "체험 중에 해지하면 결제되지 않아요. 해지는 설정 > 플랜 > 구독 관리(App Store·Google Play 구독)에서 할 수 있어요.",
    "무료 체험은 처음 구독할 때 한 번만 받을 수 있어요.",
  ];
}

export function TrialConsent({
  open,
  trialDays,
  lines,
  busy,
  error,
  onAgree,
  onCancel,
}: {
  open: boolean;
  trialDays: number;
  lines: string[];
  busy: boolean;
  error: string | null;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="trial-consent-title"
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="m-auto w-[min(360px,calc(100vw-40px))] max-w-none bg-transparent p-0"
    >
      <div className="pop rounded-[28px] bg-paper px-6 pb-6 pt-6 text-ink shadow-[0_24px_60px_rgb(31_35_64/0.35)]">
        <h2 id="trial-consent-title" className="text-[20px] font-black tracking-[-0.03em]">
          {trialDays}일 무료 체험 안내
        </h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {lines.map((l) => (
            <li key={l} className="flex gap-2 text-[15px] font-semibold leading-relaxed">
              <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango-deep" />
              {l}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-[14px] font-bold text-orange">
            {error}
          </p>
        )}
        <button type="button" autoFocus onClick={onAgree} disabled={busy} className="btn mt-6 min-h-[52px] w-full text-[16px]">
          {busy ? "결제 창을 여는 중" : `동의하고 ${trialDays}일 무료로 시작`}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="mt-2 min-h-11 w-full text-[15px] font-extrabold text-sub hover:underline">
          취소
        </button>
      </div>
    </dialog>
  );
}
