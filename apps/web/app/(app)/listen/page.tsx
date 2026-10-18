import type { Metadata } from "next";
import { ListenScreen } from "@/components/listen/ListenScreen";

export const metadata: Metadata = { title: "오늘 소식 듣기" };

export default function ListenPage() {
  return <ListenScreen />;
}
