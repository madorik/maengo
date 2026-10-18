"use client";

import type { BillingNotice } from "@/lib/billing/notice";
import { dayLabel, ManageLink, useStorePrice } from "./StoreParts";

const LINK = "text-[14px] font-extrabold text-sky-dark underline underline-offset-2";

/**
 * 결제 안내 띠(lib/billing/notice.ts가 띄울지 정한다). 오늘 화면 맨 위와 설정 > 플랜에 보인다.
 * 무료 체험이 이틀 안에 끝나면 첫 결제일과 구독 관리, 갱신 결제가 실패했으면 결제 수단 확인(스토어 구독 관리).
 * 결제 금액은 앱에서 스토어 가격을 불러왔을 때만 적는다(plans 표 가격은 스토어 가격과 다를 수 있어 쓰지 않는다)
 */
export function BillingBanner({ notice, uid, className = "" }: { notice: BillingNotice | null; uid: string; className?: string }) {
  if (!notice) return null;
  if (notice.kind === "past_due") {
    return (
      <aside role="alert" aria-label="결제 안내" className={`tile border-orange p-4 ${className}`}>
        <p className="text-[15px] font-black">Premium 결제가 안 됐어요</p>
        <div className="mt-2">
          <ManageLink uid={uid} store={notice.store} label="결제 수단 확인" className={LINK} />
        </div>
      </aside>
    );
  }
  return <TrialEnding endsAt={notice.endsAt} store={notice.store} uid={uid} className={className} />;
}

function TrialEnding({ endsAt, store, uid, className }: { endsAt: string; store?: string; uid: string; className: string }) {
  const price = useStorePrice(uid);
  return (
    <aside aria-label="무료 체험 안내" className={`tile p-4 ${className}`}>
      <p className="text-[15px] font-black">무료 체험이 {dayLabel(endsAt)}에 끝나요</p>
      {/* 자동 결제 전 고지 */}
      <p className="mt-1 text-[14px] font-semibold leading-relaxed text-sub">{price ? `그날 월 ${price}이 자동으로 결제돼요.` : "그날 자동으로 결제돼요."}</p>
      <div className="mt-2">
        <ManageLink uid={uid} store={store} label="구독 관리" className={LINK} />
      </div>
    </aside>
  );
}
