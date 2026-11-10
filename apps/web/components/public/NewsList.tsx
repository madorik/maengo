import type { Metadata } from "next";
import Link from "next/link";
import { IconBack, IconChevronRight } from "@/components/icons";
import { TopicItem } from "@/components/public/TopicItem";
import { withBase } from "@/lib/base-path";
import { archiveHref, archivePresets, isFiltered, pageWindow, rangeLabel, type ArchiveQuery } from "@/lib/public-archive";
import { detailPath, detailsOf, PUBLIC_TOPICS, topicsPath, type PublicDetail, type PublicTopic } from "@/lib/public-topics";
import { ARCHIVE_PAGE_SIZE, type PublicArchive } from "@/lib/server/public-topics";
import { APP_STORE_ID, SITE_NAME, appUrl, ogImages } from "@/lib/site";

// 1분 요약·분야·세부 주제 페이지의 소식 목록(2026-11-10 사용자 '이번주, 지난 주 구분하지말고 전체 리스트 하나로').
// 지금까지 요약한 소식 전부를 맹고가 모은 날 최신순으로 쪽마다 20개, 기간으로 좁혀 본다. 목록엔 제목·한 줄 요약·출처·원문 링크,
// 카드를 누르면 1분 요약 전체 글(/s/<토큰>). 주제·기간을 바꾸면 1쪽부터, 주제를 바꿔도 고른 기간은 남는다. 쪽을 넘기면 목록 자리(#list)로 내려온다

export const LIST_ID = "list";
const HASH = `#${LIST_ID}`;

/** 목록 범위: null이면 공개 분야 다섯 개 전부(1분 요약), 분야, 세부 주제 */
export type ListScope = PublicTopic | PublicDetail | null;

/** 범위의 페이지 주소: /topics, /topics/<분야>, /topics/<분야>/<주제> */
export const scopePath = (scope: ListScope) => (!scope ? topicsPath() : "group" in scope ? detailPath(scope) : topicsPath(scope.slug));

/**
 * 제목·설명·대표 주소. 쪽만 넘긴 주소(?page=2)는 그 주소가 대표 주소로 색인되고, 기간을 고른 주소는 noindex(같은 소식을 여러 주소로 색인하지 않게).
 * thin이면(세부 주제 소식이 너무 적으면) noindex
 */
export function listMetadata(scope: ListScope, meta: { title: string; description: string; keywords?: string[] }, query: ArchiveQuery, thin = false): Metadata {
  const title = query.page > 1 ? `${meta.title} ${query.page}쪽` : meta.title;
  const url = appUrl(isFiltered(query) ? scopePath(scope) : archiveHref(scopePath(scope), { page: query.page }));
  return {
    title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: url },
    robots: isFiltered(query) || thin ? { index: false, follow: true } : undefined,
    itunes: { appId: APP_STORE_ID },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description: meta.description, url, images: ogImages() },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description: meta.description, images: ogImages() },
  };
}

type Chip = { name: string; href: string; on: boolean };

/** 범위 칩. 1분 요약: 전체 + 분야. 분야·주제: 모든 분야 + 분야 전체 + 세부 주제 */
function scopeChips(scope: ListScope, query: ArchiveQuery): Chip[] {
  const go = (path: string) => archiveHref(path, { ...query, page: 1 }) + HASH;
  if (!scope) return [{ name: "전체", href: go(topicsPath()), on: true }, ...PUBLIC_TOPICS.map((t) => ({ name: t.name, href: go(topicsPath(t.slug)), on: false }))];
  const detail = "group" in scope ? scope : null;
  const group = detail ? detail.group : (scope as PublicTopic);
  return [
    { name: "모든 분야", href: go(topicsPath()), on: false },
    { name: `${group.name} 전체`, href: go(topicsPath(group.slug)), on: !detail },
    ...detailsOf(group).map((d) => ({ name: d.name, href: go(detailPath(d)), on: d.id === detail?.id })),
  ];
}

const chip = "inline-flex min-h-10 items-center rounded-xl px-3.5 text-[15px] font-extrabold no-underline";
const chipOn = `${chip} bg-mango text-[#1F2340]`;
const chipOff = `${chip} bg-snow text-ink hover:bg-line`;

/** 소식 목록: 범위 칩, 기간 찾기, 'N개' 제목, 소식 카드, 쪽 넘기기. 모든 분야면 카드에 분야 이름표 */
export function NewsList({ scope, archive, query, today }: { scope: ListScope; archive: PublicArchive; query: ArchiveQuery; today: string }) {
  const base = scopePath(scope);
  const pages = Math.max(1, Math.ceil(archive.total / ARCHIVE_PAGE_SIZE));
  const range = rangeLabel(query, today);
  const first = (query.page - 1) * ARCHIVE_PAGE_SIZE + 1;
  const last = first + archive.items.length - 1;
  const what = `${scope ? scope.name : "모든 분야"} 소식`;
  const fieldName = (id?: string) => PUBLIC_TOPICS.find((t) => t.id === id)?.name;
  const at = (page: number) => archiveHref(base, { ...query, page }) + HASH;

  return (
    <section id={LIST_ID} aria-labelledby="list-title" className="scroll-mt-20">
      <nav aria-label="주제로 좁히기" className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {scopeChips(scope, query).map((t) => (
            <li key={t.name}>
              {t.on ? (
                <span aria-current="page" className={chipOn}>
                  {t.name}
                </span>
              ) : (
                <Link href={t.href} className={chipOff}>
                  {t.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div role="search" aria-label="기간으로 찾기" className="tile mt-4 flex flex-col gap-3 p-4">
        <ul className="flex flex-wrap gap-2">
          {archivePresets(today).map((p) => {
            const on = p.from === query.from && p.to === query.to;
            return (
              <li key={p.label}>
                {on ? (
                  <span aria-current="true" className={chipOn}>
                    {p.label}
                  </span>
                ) : (
                  <Link href={archiveHref(base, { page: 1, from: p.from, to: p.to }) + HASH} className={chipOff}>
                    {p.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {/* 날짜 직접: 폼을 보내면 1쪽부터(쪽 번호는 넣지 않는다). 기간을 바꾸면 칸도 새 값으로 다시 그린다 */}
        <form key={`${query.from}~${query.to}`} action={withBase(base) + HASH} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 max-[359px]:grid-cols-1 sm:flex">
          <label htmlFor="list-from" className="sr-only">
            시작일
          </label>
          <input id="list-from" type="date" name="from" defaultValue={query.from} max={today} className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
          <span aria-hidden="true" className="font-bold text-faint max-[359px]:hidden">
            ~
          </span>
          <label htmlFor="list-to" className="sr-only">
            종료일
          </label>
          <input id="list-to" type="date" name="to" defaultValue={query.to} max={today} className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
          <button type="submit" className="btn btn-ink col-span-full min-h-11 shrink-0 px-5 text-[15px]">
            찾기
          </button>
        </form>
      </div>

      <h2 id="list-title" className="mt-10 text-[22px] font-black tracking-[-0.03em] md:text-[26px]">
        {range ? `${range} ${what}` : what} <span className="text-mango-deep">{archive.total.toLocaleString("ko-KR")}개</span>
      </h2>
      {archive.items.length > 0 && (
        <p className="mt-1 text-[14px] font-semibold text-sub">
          최신순 · {first}~{last}번째{pages > 1 ? ` · ${query.page}/${pages}쪽` : ""}
        </p>
      )}
      {archive.items.length > 0 ? (
        <ol className="mt-6 flex flex-col gap-3">
          {archive.items.map((it) => (
            <TopicItem key={it.clusterId} item={it} label={scope ? undefined : fieldName(it.field)} />
          ))}
        </ol>
      ) : (
        <p className="tile mt-6 p-5 text-[15px] font-semibold text-sub">
          {range ? `이 기간에 요약한 ${what}이 없어요. 기간을 넓혀 보세요.` : `아직 요약한 ${what}이 없어요. 내일 아침에 다시 모아요.`}
        </p>
      )}

      {pages > 1 && <Pager at={at} page={query.page} pages={pages} />}
    </section>
  );
}

/** 쪽 넘기기: ‹ 이전 · 1 … 4 5 [6] 7 8 … 20 · 다음 › */
function Pager({ at, page, pages }: { at: (page: number) => string; page: number; pages: number }) {
  const box = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[15px] font-extrabold tabular-nums no-underline";
  return (
    <nav aria-label="쪽 넘기기" className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={at(page - 1)} rel="prev" className={`${box} gap-0.5 text-ink hover:bg-snow`}>
              <IconBack className="size-4" />
              이전
            </Link>
          ) : (
            <span aria-hidden="true" className={`${box} gap-0.5 text-faint`}>
              <IconBack className="size-4" />
              이전
            </span>
          )}
        </li>
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 font-bold text-faint">
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span aria-current="page" className={`${box} bg-ink text-paper`}>
                  {p}
                </span>
              ) : (
                <Link href={at(p)} aria-label={`${p}쪽`} className={`${box} text-ink hover:bg-snow`}>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={at(page + 1)} rel="next" className={`${box} gap-0.5 text-ink hover:bg-snow`}>
              다음
              <IconChevronRight className="size-4" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${box} gap-0.5 text-faint`}>
              다음
              <IconChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

/** 구조화 데이터의 소식 목록(이 쪽의 소식, 원문 주소) */
export function itemListLd(archive: PublicArchive, query: ArchiveQuery) {
  return {
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: archive.items.length,
    itemListElement: archive.items.map((it, i) => ({ "@type": "ListItem", position: (query.page - 1) * ARCHIVE_PAGE_SIZE + i + 1, name: it.title, url: it.url })),
  };
}
