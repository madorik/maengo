"use client";

import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useEffect } from "react";
import { SwipePager, type SwipeTarget } from "@/components/app/SwipePager";
import { IconBack, IconChevronRight } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";
import { isAppUserAgent } from "@/lib/app-client";

/**
 * 앱의 글 상세에서 본문을 좌우로 밀어 오늘 소식의 이전·다음 글로 넘긴다(왼쪽으로 밀면 다음 글). 미는 동작은 SwipePager.
 * 오늘 목록에 있는 글만 앞뒤가 있다(보관함의 지난 글은 꺼진다). 머리말과 '이 글 듣기' 막대는 그대로 두고 본문(ArticleView의 main)만 민다.
 * 넘길 때는 기록을 쌓지 않는다: 몇 개를 넘겨 봤든 뒤로 가기는 글을 연 화면(오늘 목록)으로 돌아간다.
 */
export function ArticleSwipe({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useToday();
  const id = Number(pathname.match(/^\/article\/(\d+)$/)?.[1]);
  const index = data.items.findIndex((i) => i.clusterId === id);
  const prevItem = index > 0 ? data.items[index - 1] : undefined;
  const nextItem = index >= 0 ? data.items[index + 1] : undefined;
  const prev: SwipeTarget | undefined = prevItem && { href: `/article/${prevItem.clusterId}`, label: "이전 글", Icon: IconBack };
  const next: SwipeTarget | undefined = nextItem && { href: `/article/${nextItem.clusterId}`, label: "다음 글", Icon: IconChevronRight };

  // 앞뒤 글은 본문까지 미리 받아 둔다. 기본(로딩 뼈대까지만)이면 넘길 때마다 뼈대가 한 번 비친다
  const prevHref = prev?.href;
  const nextHref = next?.href;
  useEffect(() => {
    if (!isAppUserAgent(navigator.userAgent)) return;
    if (prevHref) router.prefetch(prevHref, { kind: PrefetchKind.FULL });
    if (nextHref) router.prefetch(nextHref, { kind: PrefetchKind.FULL });
  }, [router, prevHref, nextHref]);

  return (
    <SwipePager surface="child" prev={prev} next={next} go={(href) => router.replace(href)}>
      {children}
    </SwipePager>
  );
}
