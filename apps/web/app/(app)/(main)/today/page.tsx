import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { ReportBanner } from "@/components/report/ReportBanner";
import { BriefingHero, InsightFallback } from "@/components/today/BriefingInsight";
import { TodayList } from "@/components/today/TodayList";
import { briefingInsight } from "@/lib/server/briefing-insight";
import { getTodayData } from "@/lib/server/feed";
import { getUserContext } from "@/lib/server/user-context";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "오늘 소식" };

// 오늘 목록은 (app) 레이아웃이 읽은 오늘 피드(TodayProvider)로 그린다. 결제 안내 띠와 리포트 알림(Premium, 2026-11-10. 11-11부터 아래쪽 알림이라 자리를 먹지 않는다),
// 오늘의 흐름(2026-11-11, 처음 열 때 만드는 데 몇 초)은 따로 읽어 기다리지 않고(Suspense) 끼워 넣는다
export default function TodayPage() {
  return (
    <TodayList
      notice={
        <>
          <Suspense fallback={null}>
            <TodayBillingBanner />
          </Suspense>
          <Suspense fallback={null}>
            <ReportBanner />
          </Suspense>
        </>
      }
      insight={
        <Suspense fallback={<InsightFallback />}>
          <TodayInsight />
        </Suspense>
      }
    />
  );
}

/** 오늘 화면 머리: 오늘의 흐름(받은 소식을 엮은 한 장, Free·Premium)의 한 줄이 큰 제목. 못 만들면(키 없음·실패·소식이 하나뿐) '출근길 브리핑' 제목만 */
async function TodayInsight() {
  const profile = await requireProfile();
  const [data, ctx] = await Promise.all([getTodayData(profile), getUserContext(profile.id).catch(() => ({}))]);
  const insight = await briefingInsight(profile, data, ctx).catch((e: unknown) => {
    console.error("[today] 오늘의 흐름 실패", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  });
  // 내 맞춤 정보 질문은 여기서 대놓고 묻지 않는다(2026-11-11 사용자). 기사 아래·기사에서 넘어갈 때 한 번(components/context/ContextAsk.tsx)
  return <BriefingHero insight={insight} />;
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
