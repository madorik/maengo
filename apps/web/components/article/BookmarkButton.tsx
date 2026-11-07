"use client";

import { useState } from "react";
import { IconBookmark } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";
import { track } from "@/lib/analytics";
import type { FeedItem } from "@/lib/types";

/**
 * 글 화면의 '북마크'. 북마크한 소식은 보관함 '북마크' 거르기로 모아 본다.
 * 누른 상태는 버튼 모양(채운 아이콘, aria-pressed)으로만 보인다(확인 문장은 두지 않는다). 저장하지 못하면 되돌리고 오류만 알린다.
 * icon: 머리말 오른쪽 아이콘(공유 왼쪽). tile: 본문 출처 아래 '공유하기' 옆 버튼
 */
export function BookmarkButton({ item, variant = "icon" }: { item: Pick<FeedItem, "clusterId" | "category">; variant?: "icon" | "tile" }) {
  const { isBookmarked, setBookmark } = useToday();
  const on = isBookmarked(item.clusterId);
  const [error, setError] = useState(false);

  const toggle = async () => {
    setError(false);
    track("bookmark", { on: !on, category: item.category, where: variant === "tile" ? "body" : "header" });
    if (!(await setBookmark(item.clusterId, !on))) setError(true);
  };

  const alert = error && "북마크하지 못했어요";

  if (variant === "tile") {
    return (
      <div>
        <button
          type="button"
          aria-pressed={on}
          onClick={toggle}
          className={`tile inline-flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
        >
          <IconBookmark filled={on} className="size-5" />
          북마크
        </button>
        {alert && (
          <p role="alert" className="mt-2 text-[14px] font-bold text-cherry">
            {alert}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={on}
        aria-label="북마크"
        onClick={toggle}
        className={`inline-flex size-11 items-center justify-center rounded-xl hover:bg-snow ${on ? "text-sky" : "text-sub"}`}
      >
        <IconBookmark filled={on} className="size-5" />
      </button>
      {alert && (
        <p role="alert" className="absolute right-0 top-full mt-1 w-max rounded-lg bg-ink px-3 py-1.5 text-[13px] font-bold text-paper">
          {alert}
        </p>
      )}
    </div>
  );
}
