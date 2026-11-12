import { createContext, useContext } from "react";
import type { FeedItem } from "@/lib/types";

// 웹 TodayProvider 대신(토스판). 오늘의 흐름 카드(components/today/BriefingInsight.tsx)가 읽는 값만 준다
export interface TossToday {
  data: { items: FeedItem[]; slot: "am" | "pm"; greetingDate: string; dailyLimit: number; date: string };
  listenAccess: (clusterId: number) => string | null;
}

export const TossTodayContext = createContext<TossToday | null>(null);

export function useToday(): TossToday {
  const v = useContext(TossTodayContext);
  if (!v) throw new Error("TossTodayContext 밖에서 useToday");
  return v;
}
