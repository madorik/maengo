import { krwLabel } from "@maengo/core/plans";
import type { Metadata } from "next";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { TodayList } from "@/components/today/TodayList";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "오늘" };

export default async function TodayPage() {
  const profile = await requireProfile();
  // 무료 체험이 이틀 안에 끝나거나 갱신 결제가 실패했으면 맨 위에 결제 안내 띠
  const notice = billingNoticeOf(await subscriptionView(profile.id));
  return <TodayList notice={notice && <BillingBanner notice={notice} uid={profile.id} price={krwLabel(profile.limits.priceKrw)} className="mb-4" />} />;
}
