"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconLink, IconShare } from "@/components/icons";
import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { canShareToApps, copyText, shareToApps } from "@/lib/native/share";
import { isLinkTopicId } from "@maengo/core/topics";
import type { FeedItem } from "@/lib/types";

/**
 * 글 화면의 '공유'(2026-11-08 개편). 누르면 공유 시트가 올라와 둘 중 하나를 고른다.
 * - 링크 복사: 로그인 없이 보는 소식 주소(/s/[id], 미리보기 카드에 제목이 보인다). 내 관심 링크(사용자가 넣은 출처) 글은 공개 주소가 없어서 원문 주소
 * - 다른 앱으로 보내기: 기기 공유 창(카카오톡·문자 등 설치된 앱). 제목·요약·주소를 같이 보낸다. 공유 창이 없는 브라우저면 버튼을 숨긴다
 * icon: 머리말 오른쪽 아이콘. tile: 본문 출처 아래 '공유하기' 버튼(2026-10-31, 2026-11-07부터 '북마크' 옆, 위 여백은 둘을 감싼 줄이 둔다)
 */
export function ShareButton({
  item,
  variant = "icon",
}: {
  item: Pick<FeedItem, "clusterId" | "title" | "short" | "url" | "category" | "topicId">;
  variant?: "icon" | "tile";
}) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const place = variant === "tile" ? "body" : "header";
  const linkOnly = isLinkTopicId(item.topicId);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const link = () => (linkOnly ? item.url : `${location.origin}${withBase(`/s/${item.clusterId}`)}`);
  const openSheet = () => {
    setApps(canShareToApps());
    setCopied(false);
    setError(null);
    setOpen(true);
  };
  const copy = async () => {
    setError(null);
    if (await copyText(link())) {
      setCopied(true);
      track("share", { category: item.category, action: "copy_link", place });
    } else setError("링크를 복사하지 못했어요");
  };
  const toApps = async () => {
    setError(null);
    const text = linkOnly
      ? `${item.title}\n\n${item.short}\n\n원문 ${item.url}\n\n맹고에서 요약했어요 ${location.origin}${withBase("/")}`
      : `${item.title}\n\n${item.short}\n\n${link()}`;
    const r = await shareToApps({ title: item.title, text });
    if (r === "shared") {
      track("share", { category: item.category, action: "shared", place });
      setOpen(false);
    } else if (r === "failed") setError("공유하지 못했어요");
  };

  const shown = open ? link().replace(/^https?:\/\//, "") : "";

  return (
    <>
      {variant === "tile" ? (
        <button type="button" onClick={openSheet} className="tile inline-flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-extrabold hover:bg-snow">
          <IconShare className="size-5" />
          공유하기
        </button>
      ) : (
        <button type="button" onClick={openSheet} aria-label="공유" className="inline-flex size-11 items-center justify-center rounded-xl text-sub hover:bg-snow">
          <IconShare className="size-5" />
        </button>
      )}
      <Sheet title="공유하기" open={open} onClose={() => setOpen(false)}>
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-sub">{item.title}</p>
        <div className="mt-4 flex gap-2">
          <span className="tile flex min-h-12 min-w-0 flex-1 items-center bg-snow px-4 text-[15px] font-semibold text-sub">
            <span className="truncate">{shown}</span>
          </span>
          {/* '링크 복사' ↔ '복사됨'으로 바뀌어도 폭이 그대로이게(옆 주소 칸이 움찔하지 않게) */}
          <button type="button" onClick={copy} className="btn min-h-12 w-[124px] shrink-0 justify-center px-3 text-[15px]">
            {copied ? <IconCheck className="size-5 [stroke-width:3]" /> : <IconLink className="size-5" />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
        {apps && (
          <button
            type="button"
            onClick={toApps}
            className="tile mt-3 flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-snow"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-tint text-sky">
              <IconShare className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold">다른 앱으로 보내기</span>
              <span className="block text-[13px] font-semibold text-sub">카카오톡·문자 등 설치된 앱</span>
            </span>
          </button>
        )}
        <p role="alert" className="mt-3 text-[14px] font-bold text-cherry empty:hidden">
          {error}
        </p>
      </Sheet>
    </>
  );
}
