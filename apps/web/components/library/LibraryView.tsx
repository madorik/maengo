import Form from "next/form";
import Link from "next/link";
import { IconBack, IconClose, IconSearch } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { libraryFilterKey } from "@/lib/library-pages";
import type { LibraryData, LibraryReadFilter } from "@/lib/types";
import { InfiniteLibrary } from "./InfiniteLibrary";
import { DayGroups } from "./LibraryCards";
import { LibraryHeader, PickBar, PlaylistPicker } from "./Playlist";

// 보관함: 지금까지 받은 피드 전체. 서버에서 그린다(검색·페이지·카테고리·읽음은 주소의 ?q=&page=&category=&read=).
// 웹 브라우저는 쪽 넘기기(‹ 5 / 27 ›), 앱(iOS·안드로이드)은 끝에 가까워지면 다음 쪽을 이어 붙인다(InfiniteLibrary).
// 앱인지는 서버가 User-Agent로 정해서(page.tsx) 서버 HTML과 첫 그림이 같고, 쪽 넘기기가 잠깐 보였다 사라지지 않는다.
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

export function LibraryView({ lib, infinite }: { lib: LibraryData; /** 앱이면 이어 붙이기, 웹이면 쪽 넘기기 */ infinite: boolean }) {
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
                      : "아직 받은 소식이 없어요."}
              </p>
            </Bubble>
          </div>
        ) : infinite ? (
          <InfiniteLibrary
            key={libraryFilterKey({ category: lib.category, read: lib.readFilter, query: lib.query })}
            groups={lib.groups}
            page={lib.page}
            pageCount={lib.pageCount}
            filteredTotal={lib.filteredTotal}
            category={lib.category}
            read={lib.readFilter}
            query={lib.query}
          />
        ) : (
          <DayGroups groups={lib.groups} />
        )}

        {!infinite && lib.pageCount > 1 && <Pagination lib={lib} />}
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

/** 이전 · 지금 쪽 / 전체 쪽 · 다음. 쪽 번호를 늘어놓으면 쪽이 많을 때 좁은 화면(390px)에서 한 줄을 넘쳐서 이렇게만 둔다 */
function Pagination({ lib }: { lib: LibraryData }) {
  const { page, pageCount, category, readFilter, query } = lib;
  const box = "tile inline-flex size-11 shrink-0 items-center justify-center no-underline";
  const step = (to: number, label: string, icon: React.ReactNode, on: boolean) =>
    on ? (
      <Link href={href(to, category, readFilter, query)} aria-label={label} className={`${box} hover:bg-snow`}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden="true" className={`${box} text-line`}>
        {icon}
      </span>
    );
  return (
    <nav aria-label="페이지" className="mt-8 flex items-center justify-center gap-3">
      {step(page - 1, "이전 페이지", <IconBack />, page > 1)}
      <p aria-current="page" className="min-w-[84px] text-center font-round text-[16px] font-black tabular-nums">
        <span className="sr-only">{`${pageCount}페이지 중 `}</span>
        {page}
        <span aria-hidden="true" className="text-sub">
          {" "}
          / {pageCount}
        </span>
        <span className="sr-only">페이지</span>
      </p>
      {step(page + 1, "다음 페이지", <IconBack className="size-5 rotate-180" />, page < pageCount)}
    </nav>
  );
}
