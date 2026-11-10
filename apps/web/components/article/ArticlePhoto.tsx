"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/types";

/**
 * 원문 대표 사진(2026-11-10 사용자 "그 뉴스 소식에서 주는 이미지도 상세 페이지에 같이 보여주게 하자. 지금 유튜브 보여지는것처럼").
 * 맹고 서버에 복사하지 않고 원문 사이트의 주소에서 바로 보이며, 누르면 원문이 열린다. 사진 아래에 출처를 적는다.
 * 언론사마다 주소가 달라 next/image 허용 목록에 넣을 수 없고 이미지 최적화 비용도 들지 않게 img를 쓴다.
 * 못 불러오면(다른 사이트에서 막음·지워짐) 자리째 숨긴다. 공개 페이지(/s, 분야·지난 소식)에는 보이지 않는다
 */
export function ArticlePhoto({ item }: { item: FeedItem }) {
  const [failed, setFailed] = useState(false);
  if (!item.photo || failed) return null;
  return (
    <figure className="mt-6">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-video overflow-hidden rounded-2xl border-2 border-line bg-snow"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photo.url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="block size-full object-cover"
        />
        <span className="sr-only">원문 보기 (새 탭에서 열림)</span>
      </a>
      {item.photo.source && <figcaption className="mt-1.5 text-[12px] font-semibold text-sub">사진 · {item.photo.source}</figcaption>}
    </figure>
  );
}
