"use client";

import { PhotoImg } from "@/components/ui/PhotoImg";
import type { PhotoSize } from "@/lib/photo";
import type { FeedItem } from "@/lib/types";

/**
 * 소식 썸네일: 원문 대표 사진(맹고에 복사하지 않고 원문 주소에서 바로) → 유튜브 썸네일. 없거나 못 불러오면 그리지 않는다.
 * 작게 그리는 자리는 언론사가 주는 작은 크기로, 화면에 다가올 때만 받는다(components/ui/PhotoImg.tsx, 2026-11-11). size는 card면 카드 보기(큰 칸)
 */
export function Thumb({ item, className, size = "list" }: { item: Pick<FeedItem, "photo" | "thumbnail">; className: string; size?: PhotoSize }) {
  const src = item.photo?.url ?? item.thumbnail;
  if (!src) return null;
  return <PhotoImg key={src} src={src} size={size} className={className} />;
}
