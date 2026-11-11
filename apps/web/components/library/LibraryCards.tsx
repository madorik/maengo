"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { Thumb } from "@/components/today/Thumb";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import type { LibraryEntry } from "@/lib/types";
import type { LibraryGroup } from "@/lib/library-pages";
import { PickTarget } from "./Playlist";

// 보관함 목록(2026-11-10 사용자): 날짜·출근길·퇴근길로 묶지 않고 최신순 전체 목록 하나. 카드(사진 2열)와 목록(한 줄씩)을 고른다.
// 고른 보기는 이 기기에 남긴다. 웹은 서버가 한 쪽을 그리고(LibraryView), 앱은 이어 붙인 쪽을 브라우저가 그린다(InfiniteLibrary).

type View = "list" | "card";
const KEY = "maengo:library-view";
const listeners = new Set<() => void>();
function readView(): View {
  try {
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
        "카드로 보기",
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
      <ul aria-label="받은 소식" className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
        {entries.map((e) => (
          <EntryCard key={e.clusterId} entry={e} />
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

function Meta({ e }: { e: LibraryEntry }) {
  const label = e.section && isSection(e.section) ? SECTION_LABEL[e.section] : null;
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

function EntryCard({ entry: e }: { entry: LibraryEntry }) {
  const done = e.read || e.listened;
  const label = e.section && isSection(e.section) ? SECTION_LABEL[e.section] : null;
  return (
    <li className="group relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-snow">
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-faint">{label}</span>
        <Thumb item={{ photo: e.photo, thumbnail: null }} size="card" className="absolute inset-0 size-full" />
        <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-paper/90 group-has-[[data-pick]]:invisible">
          <BookmarkButton item={e} variant="card" />
        </span>
      </div>
      <div className="mt-2">
        <Meta e={e} />
      </div>
      <h3 className={`mt-0.5 line-clamp-2 text-[14px] font-semibold leading-[1.42] tracking-[-0.02em] ${done ? "text-sub" : "text-ink"}`}>
        <Link href={`/article/${e.token}`} className="no-underline after:absolute after:inset-0">
          {e.title}
        </Link>
      </h3>
      <PickTarget id={e.clusterId} title={e.title} />
    </li>
  );
}
