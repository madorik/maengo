import type { Metadata } from "next";
import { TodayList } from "@/components/today/TodayList";

export const metadata: Metadata = { title: "오늘" };

export default function TodayPage() {
  return <TodayList />;
}
