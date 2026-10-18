"use client";

import type { BillingNotice } from "@/lib/billing/notice";
import { ManageLink } from "./StoreParts";

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });

const LINK = "text-[14px] font-extrabold text-sky-dark underline underline-offset-2";

/**
 * 결제 안내 띠(lib/billing/notice.ts가 띄울지 정한다). 오늘 화면 맨 위와 설정 > 플랜에 보인다.
 * 무료 체험이 이틀 안에 끝나면 첫 결제일·금액과 구독 관리, 갱신 결제가 실패했으면 결제 수단 확인(스토어 구독 관리).
 * price는 체험 뒤 월 결제 금액 표기(plans 표 가격)
 */
export function BillingBanner({ notice, uid, price, className = "" }: { notice: BillingNotice | null; uid: string; price: string; className?: string }) {
  if (!notice) return null;
  if (notice.kind === "past_due") {
    return (
      <aside role="alert" aria-label="결제 안내" className={`tile border-orange p-4 ${className}`}>
        <p className="text-[15px] font-black">Premium 결제가 안 됐어요</p>
        <p className="mt-2">
          <ManageLink uid={uid} store={notice.store} label="결제 수단 확인" className={LINK} />
        </p>
      </aside>
    );
  }
  return (
    <aside aria-label="무료 체험 안내" className={`tile p-4 ${className}`}>
      <p className="text-[15px] font-black">무료 체험이 {dayLabel(notice.endsAt)}에 끝나요</p>
      {/* 자동 결제 전 고지 */}
      <p className="mt-1 text-[14px] font-semibold leading-relaxed text-sub">그날 월 {price}이 자동으로 결제돼요.</p>
      <p className="mt-2">
        <ManageLink uid={uid} store={notice.store} label="구독 관리" className={LINK} />
      </p>
    </aside>
  );
}
