"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { Thumb } from "@/components/today/Thumb";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import type { LibraryEntry } from "@/lib/types";
import type { LibraryGroup } from "@/lib/library-pages";
import { PickTarget } from "./Playlist";

// 보관함 목록(2026-11-10 사용자): 날짜·출근길·퇴근길로 묶지 않고 최신순 전체 목록 하나. 카드(사진 2열)와 목록(한 줄씩)을 고른다.
// 고른 보기는 이 기기에 남긴다. 웹은 서버가 한 쪽을 그리고(LibraryView), 앱은 이어 붙인 쪽을 브라우저가 그린다(InfiniteLibrary).
// 2026-11-12 사용자: 카드 보기를 '넘겨 보는 카드뉴스'로(정사각 카드 안에서 좌우로 표지 → 핵심 요약 → 출처), 처음 열면 카드뉴스가 기본.

type View = "list" | "card";
const KEY = "maengo:library-view";
const listeners = new Set<() => void>();
function readView(): View {
  try {
    return localStorage.getItem(KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}
function setView(v: View) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
  for (const l of listeners) l();
}
function useView(): View {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readView,
    () => "card",
  );
}

/** 카드·목록 보기 바꾸기 */
export function LibraryViewToggle() {
  const view = useView();
  const btn = (v: View, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === v}
      aria-label={label}
      onClick={() => setView(v)}
      className={`flex h-8 w-9 items-center justify-center rounded-full ${view === v ? "bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-sub"}`}
    >
      {icon}
    </button>
  );
  return (
    <div role="group" aria-label="보기 방식" className="flex gap-0.5 rounded-full bg-snow p-[3px]">
      {btn(
        "card",
        "카드뉴스로 보기",
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </svg>,
      )}
      {btn(
        "list",
        "목록으로 보기",
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>,
      )}
    </div>
  );
}

export function DayGroups({ groups }: { groups: LibraryGroup[] }) {
  const view = useView();
  const entries = groups.flatMap((g) => g.entries);
  if (view === "card") {
    return (
      <ul aria-label="받은 소식" className="mt-4 grid gap-7 md:grid-cols-2 md:gap-x-5">
        {entries.map((e) => (
          <EntryCardNews key={e.clusterId} entry={e} />
        ))}
      </ul>
    );
  }
  return (
    <ol aria-label="받은 소식" className="mt-2">
      {entries.map((e) => (
        <EntryRow key={e.clusterId} entry={e} />
      ))}
    </ol>
  );
}

/** 안 읽음·분야·시간. 카드뉴스는 표지에 분야가 있어 section={false}로 뺀다 */
function Meta({ e, section = true }: { e: LibraryEntry; section?: boolean }) {
  const label = section && e.section && isSection(e.section) ? SECTION_LABEL[e.section] : null;
  const unread = !(e.read || e.listened);
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-sub">
      {unread && <span aria-label="안 읽음" className="size-[7px] rounded-full bg-mango shadow-[0_0_0_2px_var(--color-mango-tint)]" />}
      {label && <span className="text-ink">{label}</span>}
      <span className="font-medium">{e.publishedLabel}</span>
    </p>
  );
}

function EntryRow({ entry: e }: { entry: LibraryEntry }) {
  const done = e.read || e.listened;
  return (
    <li className="group relative flex items-center gap-3 border-b border-line py-3">
      {/* 썸네일은 가로가 긴 3:2(뉴스 사진 비율, 2026-11-10 사용자 '보통 가로가 더 길어') */}
      <Thumb item={{ photo: e.photo, thumbnail: null }} className="aspect-[3/2] w-[92px] rounded-xl" />
      {/* 제목이 먼저, 분야·시간은 아래(2026-11-10 사용자) */}
      <div className="min-w-0 flex-1">
        {/* 제목은 두 줄까지, 넘치면 …(2026-11-10 사용자) */}
        <h3 className={`line-clamp-2 text-[15px] font-semibold leading-[1.42] tracking-[-0.02em] ${done ? "text-sub" : "text-ink"}`}>
          <Link href={`/article/${e.token}`} className="no-underline after:absolute after:inset-0">
            {e.title}
          </Link>
        </h3>
        <div className="mt-1">
          <Meta e={e} />
        </div>
      </div>
      {/* 고르는 중에는 고르기 체크가 이 자리에 얹혀서 감춘다 */}
      <span className="relative z-10 shrink-0 group-has-[[data-pick]]:invisible">
        <BookmarkButton item={e} variant="card" />
      </span>
      <PickTarget id={e.clusterId} title={e.title} />
    </li>
  );
}

const SLIDES = ["표지", "핵심 요약", "출처"] as const;

/**
 * 넘겨 보는 카드뉴스 한 장(2026-11-12). 정사각 카드 안을 좌우로 넘긴다(스크롤 스냅, 손가락·트랙패드).
 * 1 표지: 원문 사진 위에 분야와 큰 제목(사진이 없으면 남색 바탕). 2 핵심 요약: 요약(short). 3 출처: 언론사·시간, 전체 글 보기.
 * 표지·요약을 누르면 글 화면으로 간다. 마우스로는 아래 점을 눌러 넘긴다
 */
function EntryCardNews({ entry: e }: { entry: LibraryEntry }) {
  const done = e.read || e.listened;
  const label = e.section && isSection(e.section) ? SECTION_LABEL[e.section] : null;
  const scroller = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const href = `/article/${e.token}`;
  const go = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const slide = "relative aspect-square w-full shrink-0 snap-center overflow-hidden";
  return (
    <li className="group relative">
      <div className="relative overflow-hidden rounded-3xl bg-ink shadow-[0_0_0_1px_var(--color-line)]">
        <div
          ref={scroller}
          onScroll={(ev) => {
            const el = ev.currentTarget;
            setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          aria-roledescription="카드뉴스"
          aria-label={e.title}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* 1 표지 */}
          <section aria-label={`${SLIDES[0]} 1/3`} className={`${slide} keep-light bg-ink`}>
            {label && <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-white/30">{label}</span>}
            <Thumb item={{ photo: e.photo, thumbnail: null }} size="card" className="absolute inset-0 size-full object-cover" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              {label && <span className="inline-flex rounded-full bg-mango px-2.5 py-0.5 text-[12px] font-bold text-ink">{label}</span>}
              <h3 className={`mt-2 line-clamp-3 text-[22px] font-bold leading-[1.32] tracking-[-0.03em] text-white ${done ? "opacity-80" : ""}`}>
                <Link href={href} className="text-white no-underline after:absolute after:inset-0">
                  {e.title}
                </Link>
              </h3>
            </div>
          </section>
          {/* 2 핵심 요약 */}
          <section aria-label={`${SLIDES[1]} 2/3`} className={`${slide} bg-paper`}>
            <Link href={href} tabIndex={-1} className="flex size-full flex-col p-6 no-underline">
              <span className="text-[13px] font-bold text-mango-deep">핵심 요약</span>
              <p className="mt-3 line-clamp-[8] text-[18px] font-semibold leading-[1.62] tracking-[-0.02em] text-ink">{e.short || e.title}</p>
              <span className="mt-auto text-[13px] font-semibold text-sub">눌러서 전체 글 보기</span>
            </Link>
          </section>
          {/* 3 출처 */}
          <section aria-label={`${SLIDES[2]} 3/3`} className={`${slide} bg-snow`}>
            <div className="flex size-full flex-col p-6">
              <span className="text-[13px] font-bold text-mango-deep">출처</span>
              <p className="mt-3 text-[20px] font-bold leading-snug tracking-[-0.02em] text-ink">{e.sourceLabel}</p>
              {e.author && <p className="mt-1 text-[14px] font-medium text-sub">{e.author}</p>}
              <p className="mt-1 text-[14px] font-medium text-sub">{e.publishedLabel}</p>
              <div className="mt-auto flex flex-col gap-2">
                <Link href={href} tabIndex={-1} className="btn btn-ink min-h-12 text-[15px] no-underline">
                  전체 글 보기
                </Link>
                <p className="text-center text-[12px] font-medium text-sub">글 화면에서 듣기·원문 보기도 돼요</p>
              </div>
            </div>
          </section>
        </div>
        <span className="absolute right-3 top-3 z-10 flex group-has-[[data-pick]]:invisible">
          <BookmarkButton item={e} variant="overlay" />
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 px-1">
        <Meta e={e} section={false} />
        <div role="tablist" aria-label="카드 넘기기" className="relative z-10 flex items-center gap-1.5 group-has-[[data-pick]]:invisible">
          {SLIDES.map((name, i) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={at === i}
              aria-label={name}
              onClick={() => go(i)}
              className="flex size-5 items-center justify-center"
            >
              <span className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ${at === i ? "w-4 bg-ink" : "w-1.5 bg-line-dark"}`} />
            </button>
          ))}
        </div>
      </div>
      <PickTarget id={e.clusterId} title={e.title} />
    </li>
  );
}
