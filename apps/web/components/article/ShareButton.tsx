"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconShare } from "@/components/icons";
import { track } from "@/lib/analytics";
import { shareContent } from "@/lib/native/share";
import type { FeedItem } from "@/lib/types";

/**
 * 글 화면 위 '공유'. 제목·요약·원문 주소와 맹고 소개 주소를 보낸다(맹고 글 화면은 로그인해야 보여서 그 주소는 넣지 않는다).
 * 공유 시트가 없어 복사했으면 아이콘만 잠깐 체크로 바꾼다
 */
export function ShareButton({ item }: { item: Pick<FeedItem, "title" | "short" | "url" | "category"> }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    setError(false);
    const text = `${item.title}\n\n${item.short}\n\n원문 ${item.url}\n\n맹고에서 요약했어요 ${location.origin}/`;
    const r = await shareContent({ title: item.title, text });
    if (r === "shared" || r === "copied") track("share", { category: item.category, action: r });
    if (r === "copied") setCopied(true);
    if (r === "failed") setError(true);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={share}
        aria-label={copied ? "공유할 글을 복사했어요" : "공유"}
        className="inline-flex size-11 items-center justify-center rounded-xl text-sub hover:bg-snow"
      >
        {copied ? <IconCheck className="size-5 text-sky [stroke-width:3]" /> : <IconShare />}
      </button>
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1 w-max rounded-lg bg-ink px-3 py-1.5 text-[13px] font-bold text-paper">
          공유하지 못했어요
        </p>
      )}
    </div>
  );
}
