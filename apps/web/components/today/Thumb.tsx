"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/types";

/** 소식 썸네일: 원문 대표 사진(맹고에 복사하지 않고 원문 주소에서 바로) → 유튜브 썸네일. 없거나 못 불러오면 그리지 않는다 */
export function Thumb({ item, className }: { item: Pick<FeedItem, "photo" | "thumbnail">; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = item.photo?.url ?? item.thumbnail;
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 언론사마다 주소가 달라 next/image 허용 목록에 넣을 수 없고, 최적화 비용도 들지 않게
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`shrink-0 object-cover ${className}`} />
  );
}
