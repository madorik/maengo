"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useToday } from "@/components/providers/TodayProvider";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { Thumb } from "@/components/today/Thumb";
import { CATEGORY_LABEL } from "@maengo/core/categories";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import type { LibraryEntry } from "@/lib/types";
import type { LibraryGroup } from "@/lib/library-pages";
import { PickTarget, usePicking } from "./Playlist";

// 보관함 목록(2026-11-10 사용자): 최신순. 카드(큰 사진 넘겨 보기)와 목록(한 줄씩)을 고른다. 고른 보기는 이 기기에 남긴다.
// 웹은 서버가 한 쪽을 그리고(LibraryView), 앱은 이어 붙인 쪽을 브라우저가 그린다(InfiniteLibrary).
// 2026-11-12 사용자: 카드 보기를 '넘겨 보는 카드뉴스'로(정사각 카드 안에서 좌우로 표지 → 핵심 요약 → 출처).
// 2026-11-26 사용자 시안: 날짜 묶음 머리('오늘 2')가 돌아왔고, 처음 열면 '소식 줄' 목록이 기본이다.
// 소식 줄은 회색 상자·꽉 붙은 사진 대신 바탕 위의 줄(왼쪽 분야·제목·출처, 오른쪽 둥근 정사각 사진). 큰 사진 카드는 그대로 고를 수 있고, 한 번 고른 보기는 남는다.

type View = "list" | "card";
const KEY = "maengo:library-view";
const listeners = new Set<() => void>();
function readView(): View {
  try {
    // 예전에 '카드'를 고른 기기는 그대로 카드, 아직 고른 적 없거나 '목록'이면 소식 줄 목록
    return localStorage.getItem(KEY) === "card" ? "card" : "list";
  } catch {
    return "list";
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
    () => "list",
  );
}

/** 목록·큰 사진 카드 보기 바꾸기(보기 칩 줄 오른쪽 끝에 작게) */
export function LibraryViewToggle() {
  const view = useView();
  const btn = (v: View, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === v}
      aria-label={label}
      onClick={() => setView(v)}
      className={`flex h-[30px] w-8 items-center justify-center rounded-full ${view === v ? "bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-sub"}`}
    >
      {icon}
    </button>
  );
  return (
    <div role="group" aria-label="보기 방식" className="flex shrink-0 gap-0.5 rounded-full bg-snow p-[3px]">
      {btn(
        "list",
        "목록으로 보기",
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>,
      )}
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
    </div>
  );
}

/**
 * 날짜 묶음(오늘·어제·n월 n일)마다 머리('오늘 2') + 소식 줄(또는 카드)들.
 * 개수는 이 화면에 그린 묶음의 수라서, 쪽 경계에 걸쳐 다음·이전 쪽으로 이어지는 날(skipFirstCount·skipLastCount)은 개수를 적지 않는다(모자란 수가 보이지 않게)
 */
export function DayGroups({ groups, skipFirstCount = false, skipLastCount = false }: { groups: LibraryGroup[]; skipFirstCount?: boolean; skipLastCount?: boolean }) {
  const view = useView();
  return (
    <div>
      {groups.map((g, i) => {
        const open = (i === 0 && skipFirstCount) || (i === groups.length - 1 && skipLastCount);
        return (
          <section key={g.date} aria-label={g.label} className="mt-6">
            <h2 className="flex items-baseline gap-1.5 text-[18px] font-extrabold tracking-[-0.035em]">
              {g.label}
              {!open && (
                <span className="text-[15px] font-bold text-faint">
                  {g.entries.length}
                  <span className="sr-only">개</span>
                </span>
              )}
            </h2>
            {view === "card" ? (
              <ul className="mt-3 grid gap-7 md:grid-cols-2 md:gap-x-5">
                {g.entries.map((e) => (
                  <EntryCardNews key={e.clusterId} entry={e} />
                ))}
              </ul>
            ) : (
              <ul>
                {g.entries.map((e) => (
                  <EntryRow key={e.clusterId} entry={e} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** 분야 이름(소식의 분야, 없으면 글 종류 이름) */
function sectionLabel(e: LibraryEntry): string {
  return e.section && isSection(e.section) ? SECTION_LABEL[e.section] : CATEGORY_LABEL[e.category];
}

/** 이 화면에서 방금 읽거나 들은 것까지 더한 '읽음'(서버가 그린 값은 뒤로 가기 때 낡는다) */
function useDone(e: LibraryEntry): boolean {
  const { consumed } = useToday();
  return e.read || e.listened || consumed(e.clusterId);
}

/**
 * 소식 줄(2026-11-26 사용자 시안): 회색 상자 대신 바탕 위의 줄, 줄 사이는 얇은 선.
 * 왼쪽에 분야 이름(망고 진한 글자)·제목 두 줄·'출처, 시각'과 같은 줄 오른쪽 끝 북마크, 오른쪽에 둥근 정사각 사진(옅은 안쪽 선).
 * 읽은 소식은 '읽음' 글자를 적지 않고 제목·분야를 흐리게, 사진을 옅게 한다(화면 읽기에는 '읽음'). 사진이 없으면 사진 자리를 비우지 않고 글이 넓어진다.
 * 고르는 중에는 왼쪽에 체크 자리가 생긴다(PickTarget)
 */
function EntryRow({ entry: e }: { entry: LibraryEntry }) {
  const done = useDone(e);
  const picking = usePicking();
  const label = sectionLabel(e);
  const photo = !!e.photo?.url;
  return (
    <li className={`group relative flex items-start gap-3.5 border-b border-line py-4 ${picking ? "pl-[38px]" : ""}`}>
      <div className={`flex min-w-0 flex-1 flex-col ${photo ? "min-h-[92px]" : ""}`}>
        <p className={`text-[12px] font-bold ${done ? "text-faint" : "text-mango-deep"}`}>
          <span className="sr-only">분야 </span>
          {label}
        </p>
        {/* 제목은 두 줄까지, 넘치면 …(2026-11-10 사용자) */}
        <h3 className={`mt-1 line-clamp-2 text-[16px] font-bold leading-[1.45] tracking-[-0.03em] ${done ? "text-faint" : "text-ink"}`}>
          <Link href={`/article/${e.token}`} className="no-underline after:absolute after:inset-0">
            {e.title}
          </Link>
          {done && <span className="sr-only">, 읽음</span>}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[13px] font-medium text-sub">
          <span className="min-w-0 truncate">
            {e.sourceLabel}
            {e.publishedLabel && `, ${e.publishedLabel}`}
          </span>
          {/* 북마크한 소식은 채운 남색. 고르는 중에는 줄 전체를 고르기 버튼이 덮어서 눌리지 않게(inert) 모양만 둔다 */}
          <span inert={picking} className="relative z-10 shrink-0 [&_button[aria-pressed=true]]:text-ink">
            <BookmarkButton item={e} variant="card" />
          </span>
        </div>
      </div>
      {photo && (
        <div className={`relative size-[92px] shrink-0 overflow-hidden rounded-[14px] bg-snow ${done ? "opacity-55" : ""}`}>
          <Thumb item={{ photo: e.photo, thumbnail: null }} className="absolute inset-0 size-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 rounded-[14px] ring-1 ring-inset ring-ink/[0.07]" />
        </div>
      )}
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
  const done = useDone(e);
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
        <PickTarget id={e.clusterId} title={e.title} shape="card" />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 px-1">
        <p className="text-[12px] font-medium text-sub">
          {done && <span className="sr-only">읽음, </span>}
          {e.publishedLabel}
        </p>
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
    </li>
  );
}
