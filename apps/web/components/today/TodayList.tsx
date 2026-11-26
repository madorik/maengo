"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconPause, IconPlay } from "@/components/icons";
import { usePlayer, type PlayerApi } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { CATEGORY_LABEL } from "@maengo/core/categories";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import { useMoreArrival } from "./arrival";
import { InsightHead } from "./BriefingInsight";
import { EmptyToday } from "./EmptyToday";
import { FillToday } from "./FillToday";
import { MORE_MAX } from "@/lib/more";
import { SignupGift } from "./SignupGift";
import { Thumb } from "./Thumb";
import { startTour, useTourSeen } from "./FeatureTour";
import type { FeedItem } from "@/lib/types";

/**
 * 오늘 화면(2026-11-26 시안 6안 홈): 오전에 열면 출근길, 오후에 열면 퇴근길 브리핑.
 * 위에서부터 ① 머리(작은 줄 '출근길 브리핑, 11월 26일 수요일' + 인사이트 문장이 굵은 제목, 오른쪽에 큰 재생 원 = 브리핑 듣기)
 * ② 오늘의 흐름(사진 카드를 옆으로 넘긴다, BriefingInsight.tsx) ③ 맞춤 소식(분야 칩 + 보관함과 같은 소식 줄).
 * 예전(2026-11-10 G안)의 남색 듣기 막대·출근길 노선·목록/노선 전환·맞춤 체크 칸은 시안에 없어서 뺐다(맞춤 체크는 흐름 상세 시트의 '챙겨 볼 것'으로).
 * 퇴근길이라고 화면을 남색으로 바꾸지 않는다(2026-11-26 사용자): 출근길·퇴근길 모두 사용자가 고른 밝기를 따르고, 제목 글자로만 구분한다.
 * notice는 맨 위 결제 안내 띠, head·flows는 오늘의 인사이트(서버가 Suspense로 끼운다, today/page.tsx).
 * 오늘 소식이 아직 없으면 ②③ 대신 empty(EmptyToday: 남색 카드 + 어제 못 본 소식·다시 듣기·이번 주 일정, 2026-11-26 시안 '오늘 소식 오기 전')
 */
export function TodayList({
  notice,
  head,
  flows,
  empty,
}: {
  notice?: ReactNode;
  /** 머리의 인사이트 제목 */
  head?: ReactNode;
  /** 오늘의 흐름 */
  flows?: ReactNode;
  /** 오늘 소식이 아직 없을 때 남색 카드와 '기다리는 동안' 칸들(서버가 끼운다). 없으면 카드만 */
  empty?: ReactNode;
}) {
  const { data, game, consumed, listenAccess } = useToday();
  const player = usePlayer();
  const { expect, settle } = useMoreArrival(data.items.map((i) => i.clusterId));
  const received = Math.min(data.items.length, data.dailyLimit);
  const remaining = data.dailyLimit - received;
  const tourSeen = useTourSeen();
  const newMember = !!data.signupGift;
  useEffect(() => {
    if (newMember && game.total > 0 && !tourSeen) startTour();
  }, [newMember, game.total, tourSeen]);
  const items = data.items;
  // 브리핑을 듣는 동안(멈춤 포함) 듣는 소식 줄을 회색으로 표시하고 화면 위로 올린다(2026-11-11 사용자)
  const ride = rideOf(player, items);
  useFollowListening(ride);
  // 줄마다 재생·일시정지(2026-11-11 사용자: 버튼이 위에만 있어 불편). 듣는 줄이면 멈춤·이어서, 다른 줄이면 그 소식부터. 들을 수 없는 계정(몫을 다 쓴 Free 등)은 버튼이 없다
  const canListen = player.enabled && items.some((i) => listenAccess(i.clusterId) !== null);
  const toggle = canListen
    ? (index: number) => {
        const it = items[index];
        if (!it) return;
        if (ride?.index === index) return ride.playing ? player.pause() : player.play();
        player.playFrom(it.clusterId);
      }
    : undefined;

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-4 pt-5 lg:pt-8">
      {notice}
      {data.signupGift && tourSeen && <SignupGift gift={data.signupGift} />}

      {/* 머리: 인사이트 한 줄이 제목(서버가 만들어 끼운다). 2026-11-26 사용자: 오른쪽 재생 원을 뺐다 — 전체 듣기는 오른쪽 아래 플레이어로 */}
      <section aria-labelledby="briefing-title" className="px-1.5">
        {game.total > 0 ? head : <InsightHead headline={null} />}
      </section>

      {game.total > 0 && remaining > 0 && <FillToday remaining={remaining} onExpect={expect} onSettle={settle} />}

      {game.total > 0 ? (
        <>
          {flows}
          <NewsSection items={items} consumed={consumed} ride={ride} onToggle={toggle} />
        </>
      ) : (
        <div className="mt-4">{empty ?? <EmptyToday data={null} />}</div>
      )}

      {/* 브리핑을 다 받은 뒤 '더 보기'(10개씩, 브리핑마다 30개까지, 2026-11-12 사용자). 맹고 '하나 더 받기'를 대신한다 */}
      {game.total > 0 && remaining === 0 && (
        <FillToday
          mode="more"
          remaining={0}
          done={data.items.length - data.dailyLimit >= MORE_MAX}
          doneLabel={`${data.slot === "pm" ? "오후" : "오전"} 주요 뉴스는 다 봤어요!`}
          onExpect={expect}
          onSettle={settle}
        />
      )}
    </div>
  );
}

/** 브리핑 듣는 자리: 오늘 소식 중 몇 번째를 듣는지, 그 소식을 얼마나 들었는지(0~1), 지금 소리가 나는지 */
type Ride = { index: number; frac: number; playing: boolean };

/** 오늘 브리핑을 듣는 중(멈춤 포함)이면 그 자리. 플레이리스트를 듣거나 아직 시작 전·다 들었으면 null */
function rideOf(p: PlayerApi, items: FeedItem[]): Ride | null {
  if (p.playlist || p.cur < 0 || (p.status !== "playing" && p.status !== "paused")) return null;
  const ch = p.chapters[p.cur];
  if (!ch) return null;
  const index = items.findIndex((i) => i.clusterId === ch.clusterId);
  if (index < 0) return null;
  const span = ch.endMs - ch.startMs;
  const frac = span > 0 ? Math.min(1, Math.max(0, (p.posMs - ch.startMs) / span)) : 0;
  return { index, frac, playing: p.status === "playing" };
}

/**
 * 듣는 소식이 바뀌면 그 줄을 화면 맨 위로 올린다(2026-11-11 사용자: 듣는 소식이 옮겨 갈 때마다 그 소식이 맨 위에 보이게).
 * 소리가 나는 소식이 바뀔 때만 한 번 움직인다(멈춘 채 화면에 들어오거나, 같은 소식을 듣는 동안 내려 본 것은 건드리지 않는다)
 */
function useFollowListening(ride: Ride | null) {
  const index = ride?.index ?? -1;
  const playing = !!ride?.playing;
  /** 마지막으로 올려 준 소식(멈췄다 다시 들어도 같은 소식이면 다시 올리지 않는다). 듣기를 끝내면 지운다 */
  const shown = useRef(-1);
  useEffect(() => {
    if (index < 0) {
      shown.current = -1;
      return;
    }
    if (!playing || index === shown.current || document.visibilityState !== "visible") return;
    shown.current = index;
    const el = document.querySelector<HTMLElement>(`[data-listen-index="${index}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [index, playing]);
}

/** 자동으로 올릴 때 위쪽 막대(모바일 머리말)에 가리지 않게 남기는 자리 */
const FOLLOW_MARGIN = "scroll-mt-[calc(68px+env(safe-area-inset-top))] lg:scroll-mt-6";

function sectionLabel(item: FeedItem): string {
  return item.section && isSection(item.section) ? SECTION_LABEL[item.section] : CATEGORY_LABEL[item.category];
}

/** 소식 줄 아래 흐린 글: '언론 3곳, 오늘 오전 9시'(한 곳이면 언론사 이름) */
function metaOf(item: FeedItem): string {
  const from = (item.sourceCount ?? 0) >= 2 ? `언론 ${item.sourceCount}곳` : item.sourceLabel;
  return [from, item.publishedLabel].filter(Boolean).join(", ");
}

/**
 * 맞춤 소식(2026-11-26 시안): 제목 + '전체 보기'(보관함) → 분야 칩 줄(최신 + 오늘 받은 소식에 있는 분야, 고르면 남색) → 소식 줄 목록.
 * 칩은 오늘 목록만 거른다(듣기는 거른 것과 관계없이 오늘 브리핑 전체). 소식 줄은 보관함과 같은 모양(library/LibraryCards.tsx EntryRow)
 */
function NewsSection({
  items,
  consumed,
  ride,
  onToggle,
}: {
  items: FeedItem[];
  consumed: (id: number) => boolean;
  ride: Ride | null;
  /** 줄의 재생·일시정지 버튼. 없으면 버튼을 그리지 않는다 */
  onToggle?: (index: number) => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  // 받은 소식에 있는 분야(처음 나온 순서)
  const sections = [...new Set(items.map((i) => i.section).filter((s): s is string => !!s && isSection(s)))];
  const active = filter && sections.includes(filter) ? filter : null;
  const shown = items.map((item, i) => ({ item, i })).filter(({ item }) => !active || item.section === active);
  return (
    <section aria-labelledby="news-title" className="mt-1.5">
      <div className="flex min-h-11 items-center justify-between gap-2 px-1.5">
        <h2 id="news-title" className="text-[20px] font-extrabold tracking-[-0.04em]">
          맞춤 소식
        </h2>
        {/* '전체 보기'(보관함으로) 자리에 '전체 듣기'(2026-11-27 사용자). 보관함은 아래 메뉴에 있다 */}
        <ListenAllButton />
      </div>
      {sections.length > 0 && (
        <div role="group" aria-label="분야 거르기" className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-[22px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[null, ...sections].map((s) => {
            const on = s === active;
            return (
              <button
                key={s ?? "latest"}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={`h-9 shrink-0 rounded-full border px-4 text-[14px] tracking-[-0.02em] ${on ? "border-ink bg-ink font-extrabold text-paper" : "border-line-dark font-semibold text-ink"}`}
              >
                {s === null ? "최신" : SECTION_LABEL[s as keyof typeof SECTION_LABEL]}
              </button>
            );
          })}
        </div>
      )}
      <ul aria-label="소식" className="mt-1 px-1.5">
        {shown.map(({ item, i }, k) => {
          const listening = ride?.index === i;
          return (
            <NewsRow
              key={item.clusterId}
              item={item}
              index={i}
              first={k === 0}
              listening={listening}
              done={consumed(item.clusterId) && !listening}
              playing={listening && !!ride?.playing}
              onToggle={onToggle && (() => onToggle(i))}
            />
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 소식 줄: 보관함의 줄과 같은 모양(바탕 위의 줄, 줄 사이는 얇은 선). 왼쪽에 분야 이름(망고 진한 글자)·제목 두 줄·흐린 '언론 n곳, 시각'과
 * 같은 줄 오른쪽 끝 작은 재생 버튼, 오른쪽에 둥근 정사각 사진. 읽은 소식은 '읽음' 글자를 적지 않고 제목·분야를 흐리게, 사진을 옅게 한다(화면 읽기에는 '읽음').
 * 지금 듣는 줄은 회색 면(snow)으로 살짝 표시한다. 사진이 없으면 사진 자리를 비우지 않고 글이 넓어진다
 */
function NewsRow({
  item,
  index,
  first,
  listening,
  done,
  playing,
  onToggle,
}: {
  item: FeedItem;
  index: number;
  /** 보이는 첫 줄(기능 안내가 짚는 곳) */
  first: boolean;
  listening: boolean;
  done: boolean;
  playing: boolean;
  onToggle?: () => void;
}) {
  const photo = !!(item.photo?.url ?? item.thumbnail);
  return (
    <li
      data-listen-index={index}
      data-cluster={item.clusterId}
      data-tour={first ? "card" : undefined}
      className={`group relative flex items-start gap-3.5 border-b py-4 ${FOLLOW_MARGIN} ${listening ? "-mx-3 rounded-2xl border-transparent bg-snow px-3" : "border-line"}`}
    >
      <div className={`flex min-w-0 flex-1 flex-col ${photo ? "min-h-[92px]" : ""}`}>
        <p className={`text-[12px] font-bold ${done ? "text-faint" : "text-mango-deep"}`}>
          <span className="sr-only">분야 </span>
          {sectionLabel(item)}
        </p>
        {/* 제목은 두 줄까지, 넘치면 …(2026-11-10 사용자) */}
        <h3 className={`mt-1 line-clamp-2 text-[16px] font-bold leading-[1.45] tracking-[-0.03em] ${done ? "text-faint" : "text-ink"}`}>
          <Link href={`/article/${item.token}`} aria-current={listening ? "true" : undefined} className="no-underline after:absolute after:inset-0">
            {item.title}
          </Link>
          {done && <span className="sr-only">, 읽음</span>}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[13px] font-medium text-sub">
          <span className="min-w-0 truncate">{metaOf(item)}</span>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={playing ? `${item.title} 일시정지` : `${item.title} 듣기`}
              className={`relative z-10 -my-2 flex size-8 shrink-0 items-center justify-center rounded-full text-ink active:scale-95 motion-reduce:active:scale-100 ${listening ? "bg-paper" : "bg-snow"}`}
            >
              {playing ? <IconPause className="size-3.5" /> : <IconPlay className="ml-px size-3.5" />}
            </button>
          )}
        </div>
      </div>
      {photo && (
        <div className={`relative size-[92px] shrink-0 overflow-hidden rounded-[14px] bg-snow ${done ? "opacity-55" : ""}`}>
          <Thumb item={item} className="absolute inset-0 size-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 rounded-[14px] ring-1 ring-inset ring-ink/[0.07]" />
        </div>
      )}
    </li>
  );
}

/**
 * 맞춤 소식 머리 오른쪽의 '전체 듣기'(2026-11-27 사용자: 전체 보기 있던 자리에 전체 듣기로, 처음부터 오늘 소식 재생).
 * 읽거나 들은 소식도 건너뛰지 않고 첫 소식부터 다 들려준다(player.playFrom). 들은 게 있을 때만 보이던 '처음부터 다시 듣기'(2026-11-11)를 대신한다
 */
function ListenAllButton() {
  const p = usePlayer();
  const { data, listenAccess } = useToday();
  const canListen = p.enabled && data.items.some((i) => listenAccess(i.clusterId) !== null);
  if (!canListen) return null;
  const first = (!p.playlist && p.chapters[0]?.clusterId) || data.items[0]?.clusterId;
  return (
    <button
      type="button"
      onClick={() => {
        if (first !== undefined) p.playFrom(first);
      }}
      className="inline-flex min-h-11 items-center text-[14px] font-semibold text-sub underline underline-offset-[3px]"
    >
      전체 듣기
    </button>
  );
}
