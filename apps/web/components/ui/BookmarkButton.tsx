"use client";

import { IconBookmark } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import type { CategoryId } from "@maengo/core/categories";

/**
 * 소식 북마크 켜고 끄기. 북마크한 소식은 보관함 머리말 '북마크'로 모아 본다.
 * 누른 상태는 채운 아이콘(aria-pressed)으로만 보인다(확인 문장은 두지 않는다). 저장하지 못하면 되돌리고 오류 알림만 띄운다.
 * icon: 글 화면 머리말 오른쪽 아이콘(공유 왼쪽). tile: 글 화면 본문 '공유하기' 옆 버튼. card: 보관함·오늘 카드 오른쪽 위(읽음 표시 오른쪽)
 */
export function BookmarkButton({
  item,
  variant = "icon",
  where,
}: {
  item: { clusterId: number; category: CategoryId; title: string };
  variant?: "icon" | "tile" | "card";
  /** 분석 이벤트의 where. 없으면 모양으로 정한다(icon=header, tile=body, card=library) */
  where?: "today";
}) {
  const { isBookmarked, setBookmark } = useToday();
  const toast = useToast();
  const on = isBookmarked(item.clusterId);

  const toggle = async () => {
    track("bookmark", { on: !on, category: item.category, where: where ?? (variant === "tile" ? "body" : variant === "card" ? "library" : "header") });
    if (!(await setBookmark(item.clusterId, !on))) toast.showError("북마크하지 못했어요");
  };

  if (variant === "tile") {
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={toggle}
        className={`tile inline-flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
      >
        <IconBookmark filled={on} className="size-5" />
        북마크
      </button>
    );
  }

  if (variant === "card") {
    // 카드 전체를 덮는 글 링크(after:inset-0) 위로 올린다. 카드 위 줄 높이는 그대로 두고 누르는 자리만 44px
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`북마크: ${item.title}`}
        onClick={toggle}
        className={`relative z-[1] -my-3 -mr-2.5 inline-flex size-11 items-center justify-center rounded-xl ${on ? "text-sky" : "text-faint hover:text-sub"}`}
      >
        <IconBookmark filled={on} className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="북마크"
      onClick={toggle}
      className={`inline-flex size-11 items-center justify-center rounded-xl hover:bg-snow ${on ? "text-sky" : "text-sub"}`}
    >
      <IconBookmark filled={on} className="size-5" />
    </button>
  );
}
