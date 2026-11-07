"use client";

import { IconBookmark } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";

/**
 * 보관함 카드의 북마크 표시(채운 아이콘). 북마크는 글 화면에서만 켜고 끈다(components/article/BookmarkButton.tsx).
 * 서버가 그린 목록은 뒤로 가기에서 예전 화면 그대로라, 방금 바꾼 것까지 들고 있는 TodayProvider 값으로 그린다
 */
export function BookmarkMark({ clusterId }: { clusterId: number }) {
  const { isBookmarked } = useToday();
  if (!isBookmarked(clusterId)) return null;
  return (
    <span className="inline-flex text-sky">
      <IconBookmark filled className="size-4" />
      <span className="sr-only">북마크</span>
    </span>
  );
}
