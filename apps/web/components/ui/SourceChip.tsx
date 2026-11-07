import { IconDoc, IconPlay } from "@/components/icons";
import type { FeedItem } from "@/lib/types";

/** 카드 머리의 출처 칩(글은 하늘색, 영상은 빨간색). 오늘 목록·글 화면·둘러보기가 같이 쓴다 */
export function SourceChip({ item }: { item: Pick<FeedItem, "kind" | "sourceLabel"> }) {
  const video = item.kind === "video";
  return (
    // 매체 이름이 길면 카드 머리줄을 넘지 않게 줄인다
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-extrabold ${video ? "bg-[#FFE9E6] text-[#B8321F] tone [--tone:#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
      {video ? <IconPlay className="size-3.5 shrink-0" /> : <IconDoc className="size-3.5 shrink-0" />}
      <span className="truncate">{item.sourceLabel}</span>
    </span>
  );
}
