import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { ReportBanner } from "@/components/report/ReportBanner";
import { InsightFallback, InsightFlows, InsightHead } from "@/components/today/BriefingInsight";
import { EmptyToday } from "@/components/today/EmptyToday";
import { TodayList } from "@/components/today/TodayList";
import { briefingInsight } from "@/lib/server/briefing-insight";
import { getTodayData } from "@/lib/server/feed";
import { todayEmptyData } from "@/lib/server/today-empty";
import { getUserContext } from "@/lib/server/user-context";
import { personalOn } from "@/lib/context";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "오늘 소식" };

// 오늘 목록은 (app) 레이아웃이 읽은 오늘 피드(TodayProvider)로 그린다. 결제 안내 띠와 리포트 알림(Premium, 2026-11-10. 11-11부터 아래쪽 알림이라 자리를 먹지 않는다),
// 오늘의 인사이트(2026-11-11, 처음 열 때 만드는 데 몇 초)는 따로 읽어 기다리지 않고(Suspense) 끼워 넣는다.
// 인사이트는 머리 제목(head)과 오늘의 흐름(flows) 두 자리에 나뉘어 들어가서(2026-11-26 시안 6안: 제목 오른쪽에 재생 원이 있고 그 아래 흐름 카드)
// 자리마다 Suspense를 두고, 한 번만 만들도록 loadInsight를 같이 쓴다.
// 오늘 소식이 아직 없으면 empty 자리(남색 카드와 어제 못 본 소식·다시 듣기·이번 주 일정)가 대신 그려진다
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
      head={
        <Suspense fallback={<InsightHead headline={null} />}>
          <TodayHead />
        </Suspense>
      }
      flows={
        <Suspense fallback={<InsightFallback />}>
          <TodayFlows />
        </Suspense>
      }
      empty={
        <Suspense fallback={<EmptyToday data={null} />}>
          <TodayEmpty />
        </Suspense>
      }
    />
  );
}

/** 오늘의 인사이트(받은 소식을 엮은 한 장, Free·Premium). 같은 요청 안에서 머리와 흐름이 같이 쓰니 한 번만 만든다(react cache) */
const loadInsight = cache(async () => {
  const profile = await requireProfile();
  // 로컬 확인용: 개발 서버에서만 DEV_INSIGHT_DELAY_MS만큼 늦춰 'OO님의 맞춤 인사이트를 위해 오늘 소식을 분석하고 있어요'를 본다(2026-11-12)
  const wait = process.env.NODE_ENV !== "production" ? Number(process.env.DEV_INSIGHT_DELAY_MS ?? 0) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const [data, ctx] = await Promise.all([getTodayData(profile), getUserContext(profile.id).catch(() => ({}))]);
  const insight = await briefingInsight(profile, data, ctx).catch((e: unknown) => {
    console.error("[today] 오늘의 흐름 실패", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  });
  // 소식이 둘 이상인데 못 만들었으면 '만들지 못했어요'를 보인다(2026-11-13 사용자: 분석 중이 뜨다 말없이 사라지면 왜인지 알려 줘야 한다)
  return { insight, failed: !insight && data.items.length >= 2, personalOff: !personalOn(ctx) };
});

/** 오늘 화면 머리: 인사이트 한 줄이 제목. 못 만들면(키 없음·실패·소식이 하나뿐) '출근길 브리핑' 제목만 */
async function TodayHead() {
  const { insight, failed } = await loadInsight();
  return <InsightHead headline={insight?.headline ?? null} failed={failed} />;
}

/** 오늘의 흐름 카드. 인사이트가 없으면 이 자리는 비운다. 내 맞춤 정보 질문은 여기서 대놓고 묻지 않는다(2026-11-11 사용자, components/context/ContextAsk.tsx) */
async function TodayFlows() {
  const { insight, personalOff } = await loadInsight();
  return insight && <InsightFlows insight={insight} personalOff={personalOff} />;
}

/**
 * 오늘 소식이 아직 없을 때 남색 카드와 '기다리는 동안' 칸들(2026-11-26 시안). 보여 줄 소식이 있으면 아무것도 읽지 않는다(todayEmptyData가 null).
 * 알림 시각·관심사·못 본 소식·직전 브리핑·주간 리포트 일정은 이미 있는 조회로 읽고, 읽는 동안은 카드만 먼저 그린다(Suspense 대체)
 */
async function TodayEmpty() {
  const profile = await requireProfile();
  const data = await todayEmptyData(profile);
  return <EmptyToday data={data} />;
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
