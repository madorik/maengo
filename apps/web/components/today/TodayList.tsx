"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { IconPause, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { Spinner } from "@/components/ui/Spinner";
import { requestPlayerOpen } from "@/lib/float-dock";
import { SECTION_LABEL, SLOT_LABEL, isSection } from "@maengo/core/sections";
import { useMoreArrival } from "./arrival";
import { CommuteMango } from "./CommuteMango";
import { MakeToday } from "./MakeToday";
import { FillToday } from "./FillToday";
import { MoreToday } from "./MoreToday";
import { SignupGift } from "./SignupGift";
import { Thumb } from "./Thumb";
import { startTour, useTourSeen } from "./FeatureTour";
import type { FeedItem } from "@/lib/types";

/**
 * 오늘 화면(2026-11-10 G안): 오전에 열면 출근길, 오후에 열면 퇴근길 브리핑. 맨 위에 걸리는 시간과 '언론 N곳, 기사 N건에서 골랐어요',
 * 남색 듣기 막대, 아래는 노선(소식이 정거장, 망고가 지금 위치) 또는 사진 카드. 퇴근길은 남색 바탕.
 * 사용자가 고른 보기(노선·카드)는 이 기기에 남긴다. notice는 맨 위 결제 안내 띠(서버가 그린다, today/page.tsx)
 */
export function TodayList({ notice }: { notice?: React.ReactNode }) {
  const { data, game, consumed } = useToday();
  const player = usePlayer();
  const { expect, settle } = useMoreArrival(data.items.map((i) => i.clusterId));
  const received = Math.min(data.items.length, data.dailyLimit);
  const remaining = data.dailyLimit - received;
  const tourSeen = useTourSeen();
  const newMember = !!data.signupGift;
  useEffect(() => {
    if (newMember && game.total > 0 && !tourSeen) startTour();
  }, [newMember, game.total, tourSeen]);
  const view = useView();
  const pm = data.slot === "pm";
  const slotLabel = SLOT_LABEL[data.slot];
  // 인사 날짜 끝의 때(아침·저녁 등)는 떼고 출근길·퇴근길을 붙인다(저녁에 출근길 브리핑을 보면 "저녁 출근길"이 되지 않게)
  const day = data.greetingDate.replace(/\s*(오전|오후|새벽|아침|점심|낮|오후|저녁|밤)$/, "");
  // 걸리는 시간: 플레이어가 브리핑 음성 정보를 받았으면 그 길이(플레이어 막대와 같은 값), 아니면 글자 수 어림값
  // 걸리는 시간: 플레이어가 브리핑 음성 정보를 받았으면 그 길이(플레이어 막대와 같은 값), 아니면 글자 수 어림값.
  // 소식마다 걸리는 시간도 같은 값으로(합이 머리의 시간과 맞게)
  const chapterSec = new Map(player.playlist ? [] : player.chapters.map((c) => [c.clusterId, Math.round((c.endMs - c.startMs) / 1000)] as const));
  const items = data.items.map((i) => (chapterSec.has(i.clusterId) ? { ...i, fullSeconds: chapterSec.get(i.clusterId) } : i));
  const seconds = items.reduce((a, i) => a + (i.fullSeconds ?? 0), 0);
  // 망고의 자리: 하나도 안 들었으면 출발(-1), 들은 게 있으면 아직 안 들은 첫 소식, 다 들었으면 도착(소식 수)
  const firstLeft = data.items.findIndex((i) => !consumed(i.clusterId));
  const current = !data.items.some((i) => consumed(i.clusterId)) ? -1 : firstLeft === -1 ? data.items.length : firstLeft;

  return (
    <div className={pm ? "min-h-dvh bg-[#1F2340] text-white" : ""}>
      <div className="mx-auto max-w-[640px] px-4 pb-28 pt-5 lg:pt-8">
        {notice}
        {data.signupGift && tourSeen && <SignupGift gift={data.signupGift} />}

        <section aria-labelledby="briefing-title" className="px-1.5">
          <p className={`text-[13px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>
            {day} {slotLabel}
          </p>
          {game.total > 0 ? (
            <>
              <h1 id="briefing-title" className="mt-1 flex items-baseline gap-2.5">
                <span className="font-round text-[36px] font-black tracking-[-0.02em]">{durationLabel(seconds)}</span>
                <span className={`text-[15px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>소식 {data.items.length}개</span>
              </h1>
              {data.collected && data.collected.articles > 0 && (
                <p className={`mt-1 text-[13px] ${pm ? "text-white/65" : "text-sub"}`}>
                  언론 {data.collected.sources.toLocaleString()}곳, 기사 {data.collected.articles.toLocaleString()}건에서 골랐어요.
                </p>
              )}
            </>
          ) : (
            <h1 id="briefing-title" className="mt-1 text-[26px] font-bold tracking-[-0.035em]">
              {slotLabel} 브리핑
            </h1>
          )}
        </section>

        {game.total > 0 && <ListenBar pm={pm} label={`${slotLabel} 브리핑 듣기`} />}
        {game.total > 0 && remaining > 0 && <FillToday remaining={remaining} onExpect={expect} onSettle={settle} />}

        {game.total > 0 ? (
          <>
            <div className="mt-6 flex items-center justify-between px-1.5">
              <h2 className="text-[15px] font-bold">{slotLabel} 노선</h2>
              <ViewToggle view={view.value} onChange={view.set} pm={pm} />
            </div>
            {view.value === "card" ? (
              <CardGrid items={items} pm={pm} consumed={consumed} />
            ) : (
              <Route items={items} pm={pm} current={current} consumed={consumed} />
            )}
          </>
        ) : (
          <div className="mt-4">
            <MakeToday reason={data.emptyReason} notifyLabel={data.notifyLabel} />
          </div>
        )}

        {game.total > 0 && remaining === 0 && <MoreToday cost={data.moreCost} kept={data.wallet} onExpect={expect} onSettle={settle} />}
      </div>
    </div>
  );
}

/** 걸리는 시간: 3분 넘으면 '약 N분', 그 안이면 'N분 N초' */
function durationLabel(seconds: number): string {
  if (seconds >= 180) return `약 ${Math.round(seconds / 60)}분`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
}

function clock(seconds?: number): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const VIEW_KEY = "maengo:today-view";
const viewListeners = new Set<() => void>();
function readView(): "route" | "card" {
  try {
    return localStorage.getItem(VIEW_KEY) === "card" ? "card" : "route";
  } catch {
    return "route";
  }
}

/** 노선·카드 보기. 이 기기에 남긴다(처음은 노선) */
function useView(): { value: "route" | "card"; set: (v: "route" | "card") => void } {
  const value = useSyncExternalStore(
    (cb) => {
      viewListeners.add(cb);
      return () => viewListeners.delete(cb);
    },
    readView,
    () => "route" as const,
  );
  return {
    value,
    set: (v) => {
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {}
      for (const l of viewListeners) l();
    },
  };
}

function ViewToggle({ view, onChange, pm }: { view: "route" | "card"; onChange: (v: "route" | "card") => void; pm: boolean }) {
  const base = "flex h-8 w-9 items-center justify-center rounded-full";
  const on = pm ? "bg-white/20" : "bg-paper shadow-[0_0_0_1px_var(--color-line)]";
  const stroke = (active: boolean) => (active ? (pm ? "#FFFFFF" : "#1F2340") : pm ? "rgba(255,255,255,0.6)" : "#6B7089");
  return (
    <div role="group" aria-label="보기 방식" className={`flex gap-0.5 rounded-full p-[3px] ${pm ? "bg-white/10" : "bg-snow"}`}>
      <button type="button" aria-pressed={view === "route"} aria-label="노선으로 보기" onClick={() => onChange("route")} className={`${base} ${view === "route" ? on : ""}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke(view === "route")} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M7 4v16" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
          <circle cx="7" cy="17" r="2" fill="currentColor" />
          <path d="M12 7h8M12 17h8" />
        </svg>
      </button>
      <button type="button" aria-pressed={view === "card"} aria-label="카드로 보기" onClick={() => onChange("card")} className={`${base} ${view === "card" ? on : ""}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke(view === "card")} strokeWidth="2" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </svg>
      </button>
    </div>
  );
}

function sectionLabel(item: FeedItem): string | null {
  return item.section && isSection(item.section) ? SECTION_LABEL[item.section] : null;
}

function Meta({ item, pm }: { item: FeedItem; pm: boolean }) {
  const label = sectionLabel(item);
  return (
    <p className={`mt-1 flex gap-2 text-[12px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>
      {label && <span className={`font-semibold ${pm ? "text-white" : "text-ink"}`}>{label}</span>}
      {(item.sourceCount ?? 0) >= 2 && <span>언론 {item.sourceCount}곳</span>}
      {item.fullSeconds ? <span className="tabular-nums">{clock(item.fullSeconds)}</span> : null}
    </p>
  );
}

/** 노선: 출발 → 소식(정거장) → 도착. 지나온 구간은 흐리게, 망고는 지금 들을 차례인 정거장에 */
function Route({ items, pm, current, consumed }: { items: FeedItem[]; pm: boolean; current: number; consumed: (id: number) => boolean }) {
  const line = "#FFC23D";
  const passed = pm ? "rgba(255,255,255,0.22)" : "#D5D8E0";
  const at = current;
  const headline = (items[0]?.sourceCount ?? 0) >= 2;
  return (
    <ol aria-label="노선" className="mt-3 px-1">
      <li className="flex h-12 items-center gap-3">
        <div aria-hidden="true" className="relative h-12 w-8 shrink-0">
          <span className="absolute bottom-0 left-[13px] top-6 w-1.5" style={{ background: at >= 0 ? passed : line }} />
          {at === -1 ? (
            <span className="absolute -left-1 top-0">
              <CommuteMango slot={pm ? "pm" : "am"} className="size-10" />
            </span>
          ) : (
            <span className="absolute left-[10px] top-[18px] size-3 rounded-full" style={{ background: passed }} />
          )}
        </div>
        <span className={`text-[12px] font-bold ${pm ? "text-mango" : "text-mango-deep"}`}>출발</span>
      </li>
      {items.map((item, i) => {
        const done = consumed(item.clusterId);
        const here = i === at;
        const big = i === 0;
        return (
          <li key={item.clusterId} className="flex gap-3" data-tour={i === 0 ? "card" : undefined}>
            <div aria-hidden="true" className="relative w-8 shrink-0">
              <span className="absolute left-[13px] top-0 h-7 w-1.5" style={{ background: i <= at ? passed : line }} />
              <span className="absolute bottom-0 left-[13px] top-7 w-1.5" style={{ background: i < at ? passed : line }} />
              {here ? (
                <span className="absolute -left-1 top-2">
                  <CommuteMango slot={pm ? "pm" : "am"} className="size-10" />
                </span>
              ) : (
                <span
                  className={`absolute rounded-full ${big ? "left-[6px] top-[18px] size-5 border-[5px]" : "left-[9px] top-[21px] size-3.5 border-4"}`}
                  style={{ borderColor: i < at ? passed : line, background: i < at ? passed : pm ? "#1F2340" : "#FFFFFF" }}
                />
              )}
            </div>
            <Link
              href={`/article/${item.token}`}
              className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 no-underline ${here ? (pm ? "my-1 rounded-2xl bg-white/10 px-3" : "my-1 rounded-2xl bg-[#FFF6DD] px-3") : ""}`}
            >
              <div className="min-w-0 flex-1">
                {big && headline && (
                  <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${pm ? "bg-mango/20 text-mango" : "bg-mango-tint text-mango-deep"}`}>가장 많이 다룬 소식</span>
                )}
                <p
                  className={`${big ? "text-[17px] font-bold" : "text-[15px] font-semibold"} leading-[1.42] tracking-[-0.02em] ${done ? (pm ? "text-white/45" : "text-faint") : pm ? "text-white" : "text-ink"}`}
                >
                  {item.title}
                </p>
                <Meta item={item} pm={pm} />
              </div>
              <Thumb item={item} className={big ? "size-[72px] rounded-2xl" : "size-[52px] rounded-[14px]"} />
            </Link>
          </li>
        );
      })}
      <li className="flex h-12 items-center gap-3">
        <div aria-hidden="true" className="relative h-12 w-8 shrink-0">
          <span className="absolute left-[13px] top-0 h-3 w-1.5" style={{ background: at >= items.length ? passed : line }} />
          {at >= items.length ? (
            <span className="absolute -left-1 top-1">
              <CommuteMango slot={pm ? "pm" : "am"} className="size-10" />
            </span>
          ) : (
            <span className={`absolute left-[5px] top-[10px] flex size-[22px] items-center justify-center rounded-[7px] ${pm ? "bg-mango" : "bg-ink"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pm ? "#1F2340" : "#FFC23D"} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )}
        </div>
        <span className="text-[12px] font-bold">도착</span>
        <span className={`text-[12px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>{pm ? "집에 가기 전에 끝나요" : "회사 도착 전에 끝나요"}</span>
      </li>
    </ol>
  );
}

/** 사진 카드 보기: 2열, 사진이 없으면 분야 이름 칸 */
function CardGrid({ items, pm, consumed }: { items: FeedItem[]; pm: boolean; consumed: (id: number) => boolean }) {
  return (
    <ul aria-label="소식" className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
      {items.map((item, i) => {
        const done = consumed(item.clusterId);
        const label = sectionLabel(item);
        return (
          <li key={item.clusterId} data-tour={i === 0 ? "card" : undefined} className={i === 0 && (item.sourceCount ?? 0) >= 2 ? "col-span-2" : ""}>
            <Link href={`/article/${item.token}`} className="block no-underline">
              <div className={`relative overflow-hidden rounded-2xl ${i === 0 && (item.sourceCount ?? 0) >= 2 ? "aspect-video" : "aspect-[4/3]"} ${pm ? "bg-white/10" : "bg-snow"}`}>
                <span className={`absolute inset-0 flex items-center justify-center text-[13px] font-semibold ${pm ? "text-white/50" : "text-faint"}`}>{label}</span>
                <Thumb item={item} className="absolute inset-0 size-full" />
              </div>
              <Meta item={item} pm={pm} />
              <p className={`mt-0.5 line-clamp-3 text-[15px] font-semibold leading-[1.42] tracking-[-0.02em] ${done ? (pm ? "text-white/45" : "text-faint") : pm ? "text-white" : "text-ink"}`}>{item.title}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 듣기 막대(오늘 브리핑 전체 듣기): 플레이어로 듣고 창을 재생 목록으로 편다. 듣는 중이면 일시정지.
 * Free도 오늘 듣기 몫(plans.daily_listens) 안에서 쓴다. 몫을 다 써서 들을 소식이 하나도 없으면 결제 페이지로
 */
function ListenBar({ pm, label }: { pm: boolean; label: string }) {
  const p = usePlayer();
  const { data, listenAccess } = useToday();
  const shell = `mt-4 flex h-[60px] w-full items-center gap-3 rounded-full pl-2 pr-5 text-left no-underline ${pm ? "bg-white text-ink" : "bg-ink text-white"}`;
  const knob = "flex size-11 shrink-0 items-center justify-center rounded-full bg-mango text-ink";
  if (!p.enabled || !data.items.some((i) => listenAccess(i.clusterId) !== null)) {
    return (
      <Link href="/premium" data-tour="listen-all" aria-label={`${label}, Premium에서 들을 수 있어요`} className={shell}>
        <span className={knob}>
          <IconPlay className="size-[18px]" />
        </span>
        <span className="flex-1 text-[16px] font-bold">{label}</span>
        <PremiumBadge />
      </Link>
    );
  }
  const playingToday = !p.playlist && p.status === "playing";
  return (
    <button
      type="button"
      data-tour="listen-all"
      onClick={() => {
        if (playingToday) return p.pause();
        // 재생은 누른 손짓 안에서 먼저 건다(iOS 자동 재생 정책), 창은 그다음에
        p.playToday();
        requestPlayerOpen();
      }}
      aria-busy={p.starting || undefined}
      aria-label={playingToday ? `${label} 일시정지` : label}
      className={shell}
    >
      <span className={knob}>{p.starting ? <Spinner /> : playingToday ? <IconPause className="size-[18px]" /> : <IconPlay className="size-[18px]" />}</span>
      <span className="flex-1 text-[16px] font-bold">{playingToday ? "듣는 중" : label}</span>
    </button>
  );
}
