import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { TodayList } from "@/components/today/TodayList";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "오늘" };

// 오늘 목록은 (app) 레이아웃이 읽은 오늘 피드(TodayProvider)로 그린다. 결제 안내 띠는 따로 읽어 기다리지 않고(Suspense) 끼워 넣는다
export default function TodayPage() {
  return (
    <TodayList
      notice={
        <Suspense fallback={null}>
          <TodayBillingBanner />
        </Suspense>
      }
    />
  );
}

/** 무료 체험이 이틀 안에 끝나거나 갱신 결제가 실패했으면 맨 위에 결제 안내 띠. 구독을 못 읽으면 띠 없이(오늘 목록은 그대로) */
async function TodayBillingBanner() {
  const profile = await requireProfile();
  const sub = await subscriptionView(profile.id).catch((e: unknown) => {
    console.error("[today] 구독 읽기 실패", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  });
  const notice = billingNoticeOf(sub);
  return notice && <BillingBanner notice={notice} uid={profile.id} className="mb-4" />;
}
