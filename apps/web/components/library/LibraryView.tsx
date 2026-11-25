import Form from "next/form";
import Link from "next/link";
import { IconBack, IconClose, IconSearch } from "@/components/icons";
import { libraryFilterKey, type LibraryFilters } from "@/lib/library-pages";
import type { LibraryData } from "@/lib/types";
import { InfiniteLibrary } from "./InfiniteLibrary";
import { DayGroups, LibraryViewToggle } from "./LibraryCards";
import { LibraryHeader, PickBar, PickSummary, PlaylistPicker } from "./Playlist";
import { SectionTabs } from "./SectionTabs";

// 보관함: 지금까지 받은 피드 전체. 서버에서 그린다(검색·페이지·분야·읽음·북마크는 주소의 ?q=&page=&section=&read=&bookmark=1).
// 웹 브라우저는 쪽 넘기기(‹ 5 / 27 ›), 앱(iOS·안드로이드)은 끝에 가까워지면 다음 쪽을 이어 붙인다(InfiniteLibrary).
// 앱인지는 서버가 User-Agent로 정해서(page.tsx) 서버 HTML과 첫 그림이 같고, 쪽 넘기기가 잠깐 보였다 사라지지 않는다.
// '골라 듣기'로 고른 소식을 이어 듣는다(Playlist.tsx, Premium).
// 2026-11-26 사용자 시안: 큰 제목 + '골라 듣기' 알약 → 둥근 회색 검색창 → 보기 칩(전체·안 읽음·북마크) → 분야 탭 → 날짜 묶음 + 소식 줄.

function href(page: number, { section, read, bookmark, query }: LibraryFilters): string {
  const q = new URLSearchParams();
  if (query) q.set("q", query);
  if (section) q.set("section", section);
  if (read) q.set("read", read);
  if (bookmark) q.set("bookmark", "1");
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/library?${s}` : "/library";
}

/** 지금 화면의 거르기 */
const filtersOf = (lib: LibraryData): LibraryFilters => ({ section: lib.section, read: lib.readFilter, bookmark: lib.bookmark, query: lib.query });

/** 빈 목록일 때 맹고가 하는 말 */
function emptyMessage(lib: LibraryData): string {
  if (lib.query && lib.matchedTotal === 0) return `‘${lib.query}’로 찾은 소식이 없어요.`;
  if (lib.bookmark) return lib.readFilter === "unread" ? "안 읽은 북마크가 없어요." : "북마크한 소식이 없어요.";
  if (lib.readFilter === "unread") return "안 읽은 소식이 없어요.";
  return lib.section ? "이 분야에는 아직 받은 소식이 없어요." : "아직 받은 소식이 없어요.";
}

export function LibraryView({ lib, infinite }: { lib: LibraryData; /** 앱이면 이어 붙이기, 웹이면 쪽 넘기기 */ infinite: boolean }) {
  const f = filtersOf(lib);
  return (
    <div className="mx-auto max-w-[680px] px-5 pb-6 pt-[22px] lg:py-10">
      <PlaylistPicker>
        <LibraryHeader total={lib.total} />

        {lib.total > 0 && <SearchBox lib={lib} />}

        {/* 보기 칩: 전체 · 안 읽음 · 북마크. 안 읽음·북마크·분야는 같이 걸 수 있고, 켜진 칩을 다시 누르면 풀린다.
            '전체'는 안 읽음·북마크를 푼다(분야·검색어는 그대로). 칩 줄 오른쪽 끝에 목록·카드 보기 바꾸기 */}
        {lib.matchedTotal > 0 && (
          <div className="mt-[18px] flex items-center gap-2">
            <nav aria-label="보기" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip href={href(1, { ...f, read: null, bookmark: false })} active={!lib.readFilter && !lib.bookmark} label="전체" count={lib.readCounts.all} />
              <FilterChip href={href(1, { ...f, read: lib.readFilter === "unread" ? null : "unread" })} active={lib.readFilter === "unread"} label="안 읽음" count={lib.readCounts.unread} />
              <FilterChip href={href(1, { ...f, bookmark: !lib.bookmark })} active={lib.bookmark} label="북마크" count={lib.bookmarkCount} />
            </nav>
            {lib.groups.length > 0 && <LibraryViewToggle />}
          </div>
        )}

        {/* 분야 탭: 모든 분야 + 받은 소식에 있는 분야들(켠 탭을 다시 누르거나 '모든 분야'를 누르면 풀린다) */}
        {lib.matchedTotal > 0 && lib.sections.length > 0 && (
          <SectionTabs
            tabs={[
              { href: href(1, { ...f, section: null }), label: "모든 분야", on: !lib.section, count: lib.readCounts.all },
              ...lib.sections.map((c) => ({ href: href(1, { ...f, section: lib.section === c.id ? null : c.id }), label: c.label, on: lib.section === c.id, count: c.count })),
            ]}
          />
        )}

        <PickSummary pickIds={lib.pickIds} />

        {lib.groups.length === 0 ? (
          // 회색 둥근 상자에 안내 한 줄(시안, 2026-11-26)
          <div className="mt-7 rounded-[18px] bg-snow px-[18px] py-[26px] text-center">
            <p className="text-[15px] font-semibold leading-relaxed text-sub">{emptyMessage(lib)}</p>
            {lib.bookmark && lib.bookmarkCount === 0 && (
              <p className="mt-1 text-[14px] font-medium leading-relaxed text-sub">소식 카드나 글 화면에서 북마크를 누르면 여기에 모여요.</p>
            )}
          </div>
        ) : infinite ? (
          <InfiniteLibrary
            key={libraryFilterKey(f)}
            groups={lib.groups}
            page={lib.page}
            pageCount={lib.pageCount}
            filteredTotal={lib.filteredTotal}
            {...f}
          />
        ) : (
          <DayGroups groups={lib.groups} skipFirstCount={lib.page > 1} skipLastCount={lib.page < lib.pageCount} />
        )}

        {!infinite && lib.pageCount > 1 && <Pagination lib={lib} />}
        <PickBar />
      </PlaylistPicker>
    </div>
  );
}

/** 제목·요약·출처로 찾기. 엔터(키보드 '검색')로 주소의 ?q=를 바꾼다. 분야·읽음·북마크 거르기는 그대로 */
function SearchBox({ lib }: { lib: LibraryData }) {
  return (
    <Form action="/library" role="search" className="relative mt-4">
      {lib.section && <input type="hidden" name="section" value={lib.section} />}
      {lib.readFilter && <input type="hidden" name="read" value={lib.readFilter} />}
      {lib.bookmark && <input type="hidden" name="bookmark" value="1" />}
      <label htmlFor="library-q" className="sr-only">
        보관함 검색
      </label>
      <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        id="library-q"
        key={lib.query ?? ""}
        name="q"
        type="search"
        defaultValue={lib.query ?? ""}
        placeholder="제목이나 요약으로 찾기"
        enterKeyHint="search"
        maxLength={40}
        autoComplete="off"
        className="h-12 w-full appearance-none rounded-full border border-transparent bg-snow pl-11 pr-12 text-[16px] font-medium placeholder:text-sub focus:border-sky focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {lib.query && (
        <Link
          href={href(1, { ...filtersOf(lib), query: null })}
          aria-label="검색어 지우기"
          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-sub hover:bg-line"
        >
          <IconClose className="size-5" />
        </Link>
      )}
    </Form>
  );
}

/** 보기 칩(높이 38 알약, 끝에 흐린 개수). 고르면 남색 바탕 흰 글자(오늘 화면의 고른 칩과 같다) */
function FilterChip({ href: to, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-bold no-underline ${
        active ? "bg-ink text-paper" : "bg-snow text-ink hover:bg-line"
      }`}
    >
      {label}
      <span className={`text-[14px] ${active ? "text-paper/60" : "text-faint"}`}>{count}</span>
    </Link>
  );
}

/** 이전 · 지금 쪽 / 전체 쪽 · 다음. 쪽 번호를 늘어놓으면 쪽이 많을 때 좁은 화면(390px)에서 한 줄을 넘쳐서 이렇게만 둔다 */
function Pagination({ lib }: { lib: LibraryData }) {
  const { page, pageCount } = lib;
  const f = filtersOf(lib);
  const box = "tile inline-flex size-11 shrink-0 items-center justify-center no-underline";
  const step = (to: number, label: string, icon: React.ReactNode, on: boolean) =>
    on ? (
      <Link href={href(to, f)} aria-label={label} className={`${box} hover:bg-snow`}>
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
