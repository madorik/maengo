import { useMemo } from "react";
import { sectionOf } from "@maengo/core/sections";
import { BriefingHero } from "@/components/today/BriefingInsight";
import type { BriefingInsight } from "@/lib/server/briefing-insight";
import type { FeedItem, GuestItem } from "@/lib/types";
import { TossTodayContext, type TossToday } from "./shims/today";

// 오늘의 흐름(토스 공통판). 앱 오늘 화면의 머리(BriefingHero)를 그대로 쓰고, 머리 위 말만 '맞춤' 대신 공통판 이름으로.
// 묶인 소식을 누르면(/article/toss-<번호>) main.tsx가 그 소식부터 듣게 한다

/** '11월 12일 목요일'(한국 시각) */
function kstDayLabel(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 3600_000);
  const day = ["일", "월", "화", "수", "목", "금", "토"][k.getUTCDay()];
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${day}요일`;
}

function toFeedItem(g: GuestItem, rank: number): FeedItem {
  return {
    rank,
    clusterId: g.clusterId,
    token: `toss-${g.clusterId}`,
    feedDate: "",
    title: g.title,
    kind: g.kind,
    category: g.category,
    sourceLabel: g.sourceLabel,
    author: g.author,
    publishedLabel: "",
    url: g.url,
    thumbnail: null,
    photo: g.photo ? { url: g.photo, source: g.sourceLabel } : null,
    section: sectionOf({ category: g.category }),
    short: g.short,
    body: [],
    topicId: "",
    topicName: "",
    why: "",
  };
}

export function TossInsightHero({ insight, items }: { insight: BriefingInsight; items: GuestItem[] }) {
  const value = useMemo<TossToday>(
    () => ({
      // 출근길 톤(흰 바탕)으로만 그린다. 퇴근길 톤은 남색 바탕용이라 둘러보기 화면에서는 글자가 안 보인다
      data: { items: items.map((g, i) => toFeedItem(g, i + 1)), slot: "am", greetingDate: kstDayLabel(), dailyLimit: items.length, date: "" },
      listenAccess: () => "free",
    }),
    [items],
  );
  return (
    <TossTodayContext.Provider value={value}>
      <BriefingHero insight={insight} label="AI가 엮은 오늘의 인사이트" />
    </TossTodayContext.Provider>
  );
}
