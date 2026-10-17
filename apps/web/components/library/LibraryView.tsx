import Form from "next/form";
import Link from "next/link";
import { IconBack, IconClose, IconDoc, IconNext, IconPlay, IconSearch } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import type { LibraryData, LibraryEntry, LibraryReadFilter } from "@/lib/types";
import { LibraryHeader, PickBar, PickTarget, PlaylistPicker } from "./Playlist";
import { ReadBadge } from "./ReadBadge";

// 보관함: 지금까지 받은 피드 전체. 서버에서 그린다(검색·페이지·카테고리·읽음은 주소의 ?q=&page=&category=&read=).
// '골라 듣기'로 고른 소식을 이어 듣는다(Playlist.tsx, Premium).

function href(page: number, category: string | null, read: LibraryReadFilter | null, query: string | null): string {
  const q = new URLSearchParams();
  if (query) q.set("q", query);
  if (category) q.set("category", category);
  if (read) q.set("read", read);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/library?${s}` : "/library";
}

export function LibraryView({ lib }: { lib: LibraryData }) {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 lg:py-10">
      <PlaylistPicker>
        <LibraryHeader total={lib.total} pickIds={lib.pickIds} />

        {lib.total > 0 && <SearchBox lib={lib} />}

        {/* 한 줄 거르기: 전체 · 안 읽음 · 카테고리들. 안 읽음과 카테고리는 같이 걸 수 있고, 켜진 칸을 다시 누르면 풀린다. 검색어는 그대로 둔다 */}
        {lib.matchedTotal > 0 && (
          <nav aria-label="거르기" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
            <FilterLink href={href(1, null, null, lib.query)} active={!lib.category && !lib.readFilter} label="전체" count={lib.matchedTotal} />
            <FilterLink href={href(1, lib.category, lib.readFilter === "unread" ? null : "unread", lib.query)} active={lib.readFilter === "unread"} label="안 읽음" count={lib.readCounts.unread} />
            {lib.categories.map((c) => (
              <FilterLink key={c.id} href={href(1, lib.category === c.id ? null : c.id, lib.readFilter, lib.query)} active={lib.category === c.id} label={c.label} count={c.count} />
            ))}
          </nav>
        )}

        {lib.groups.length === 0 ? (
          <div className="mt-10 flex items-end gap-3">
            <Mascot className="size-24 shrink-0" />
            <Bubble className="mb-6 flex-1">
              <p className="text-[16px] font-bold leading-relaxed">
                {lib.query && lib.matchedTotal === 0
                  ? `‘${lib.query}’로 찾은 소식이 없어요.`
                  : lib.readFilter === "unread"
                  ? "안 읽은 소식이 없어요."
                  : lib.category
                      ? "이 카테고리에는 아직 받은 소식이 없어요."
                      : "아직 받은 소식이 없어요. 내일 아침부터 여기에 쌓여요."}
              </p>
            </Bubble>
          </div>
        ) : (
          lib.groups.map((g) => (
            <section key={g.date} aria-labelledby={`day-${g.date}`} className="mt-7">
              <h2 id={`day-${g.date}`} className="px-1 text-[15px] font-black text-sub">
                {g.label}
              </h2>
              <ol className="mt-3 flex flex-col gap-3">
                {g.entries.map((e) => (
                  <LibraryCard key={e.clusterId} entry={e} />
                ))}
              </ol>
            </section>
          ))
        )}

        {lib.pageCount > 1 && <Pagination lib={lib} />}
        <PickBar />
      </PlaylistPicker>
    </div>
  );
}

/** 제목·요약·출처로 찾기. 엔터(키보드 '검색')로 주소의 ?q=를 바꾼다. 카테고리·읽음 거르기는 그대로 */
function SearchBox({ lib }: { lib: LibraryData }) {
  return (
    <Form action="/library" role="search" className="relative mt-4">
      {lib.category && <input type="hidden" name="category" value={lib.category} />}
      {lib.readFilter && <input type="hidden" name="read" value={lib.readFilter} />}
      <label htmlFor="library-q" className="sr-only">
        보관함 검색
      </label>
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        id="library-q"
        key={lib.query ?? ""}
        name="q"
        type="search"
        defaultValue={lib.query ?? ""}
        placeholder="제목·요약으로 찾기"
        enterKeyHint="search"
        maxLength={40}
        autoComplete="off"
        className="tile h-12 w-full appearance-none pl-11 pr-12 text-[16px] font-bold placeholder:font-semibold placeholder:text-faint focus:border-sky focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {lib.query && (
        <Link
          href={href(1, lib.category, lib.readFilter, null)}
          aria-label="검색어 지우기"
          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-sub hover:bg-snow"
        >
          <IconClose className="size-5" />
        </Link>
      )}
    </Form>
  );
}

function FilterLink({ href: to, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={`tile inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3.5 text-[14px] font-extrabold no-underline ${
        active ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"
      }`}
    >
      {label}
      <span className={`font-round text-[13px] ${active ? "" : "text-faint"}`}>{count}</span>
    </Link>
  );
}

function LibraryCard({ entry: e }: { entry: LibraryEntry }) {
  const video = e.kind === "video";
  return (
    <li className="group tile relative p-4 transition-colors hover:bg-snow">
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={e.category} />
        <span className="inline-flex items-center gap-1 text-sub">
          {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
          {e.sourceLabel}
        </span>
        <span className="ml-auto shrink-0 group-has-[[data-pick]]:invisible">
          <ReadBadge clusterId={e.clusterId} read={e.read || e.listened} />
        </span>
      </div>
      <h3 className="mt-2 text-[17px] font-black leading-snug tracking-[-0.02em]">
        <Link href={`/article/${e.clusterId}`} className="no-underline after:absolute after:inset-0 after:rounded-2xl">
          {e.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[14px] font-medium leading-relaxed text-sub">{e.short}</p>
      <p className="mt-2 truncate text-[13px]">
        <span className="font-extrabold">{e.author}</span>
        <span className="ml-2 font-semibold text-faint">{e.publishedLabel}</span>
      </p>
      <PickTarget id={e.clusterId} title={e.title} />
    </li>
  );
}

/** 이전 · 쪽 번호 · 다음. 쪽이 많아도 현재 쪽 앞뒤 2쪽과 처음·끝만 보여 준다 */
function Pagination({ lib }: { lib: LibraryData }) {
  const { page, pageCount, category, readFilter, query } = lib;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 2);
  const box = "tile inline-flex size-11 items-center justify-center font-round text-[15px] font-black no-underline";
  return (
    <nav aria-label="페이지" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1, category, readFilter, query)} aria-label="이전 페이지" className={`${box} hover:bg-snow`}>
          <IconBack />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} text-line`}>
          <IconBack />
        </span>
      )}
      {pages.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - pages[i - 1]! > 1 && <span className="px-1 text-faint">…</span>}
          <Link
            href={href(n, category, readFilter, query)}
            aria-label={`${n}페이지`}
            aria-current={n === page ? "page" : undefined}
            className={`${box} ${n === page ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={href(page + 1, category, readFilter, query)} aria-label="다음 페이지" className={`${box} hover:bg-snow`}>
          <IconNext />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} text-line`}>
          <IconNext />
        </span>
      )}
    </nav>
  );
}
