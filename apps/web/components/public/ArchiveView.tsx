import type { Metadata } from "next";
import Link from "next/link";
import { IconBack, IconChevronRight } from "@/components/icons";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { TopicItem } from "@/components/public/TopicItem";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { withBase } from "@/lib/base-path";
import { archiveHref, archivePresets, isFiltered, pageWindow, rangeLabel, type ArchiveQuery } from "@/lib/public-archive";
import { archivePath, detailPath, detailsOf, topicsPath, type PublicDetail, type PublicTopic } from "@/lib/public-topics";
import { ARCHIVE_PAGE_SIZE, DETAIL_MIN_ITEMS, type PublicArchive } from "@/lib/server/public-topics";
import { APP_STORE_ID, SITE_NAME, appUrl, ogImages, organizationId } from "@/lib/site";

// 지난 소식(분야·세부 주제 공용, 2026-11-10). 지금까지 요약한 소식을 최신순으로 쪽마다 20개, 기간으로 좁혀 본다.
// 공개 범위는 분야 페이지와 같다(제목·한 줄 요약·출처·원문 링크). 주제·기간을 바꾸면 1쪽부터, 주제를 바꿔도 고른 기간은 남는다

/**
 * 제목·설명·주소. 검색어는 제목·설명에만 '뉴스 요약'(용어 정책). 기간을 고른 주소는 noindex(같은 소식을 여러 주소로 색인하지 않게),
 * 쪽만 넘긴 주소는 그 쪽 주소가 대표 주소다. 세부 주제에 소식이 DETAIL_MIN_ITEMS개보다 적으면 주제 페이지처럼 noindex
 */
export function archiveMetadata(topic: PublicTopic | PublicDetail, query: ArchiveQuery, total: number): Metadata {
  const base = archivePath(topic);
  const title = `${topic.name} 지난 뉴스 요약 모음${query.page > 1 ? ` ${query.page}쪽` : ""}`;
  const description = `맹고가 AI로 요약한 ${topic.name} 소식 ${total.toLocaleString("ko-KR")}개를 최신순으로 모았어요. 소식마다 두 줄 요약과 원문 링크가 있고, 기간을 골라 찾아볼 수 있어요.`;
  const url = appUrl(isFiltered(query) ? base : archiveHref(base, { page: query.page }));
  const noindex = isFiltered(query) || ("group" in topic && total < DETAIL_MIN_ITEMS);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : undefined,
    itunes: { appId: APP_STORE_ID },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, url, images: ogImages() },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description, images: ogImages() },
  };
}

const chip = "inline-flex min-h-10 items-center rounded-xl px-3.5 text-[15px] font-extrabold no-underline";
const chipOn = `${chip} bg-mango text-[#1F2340]`;
const chipOff = `${chip} bg-snow text-ink hover:bg-line`;

export function ArchiveView({ topic, archive, query, today }: { topic: PublicTopic | PublicDetail; archive: PublicArchive; query: ArchiveQuery; today: string }) {
  const detail = "group" in topic ? topic : null;
  const group = detail ? detail.group : (topic as PublicTopic);
  const base = archivePath(topic);
  const pages = Math.max(1, Math.ceil(archive.total / ARCHIVE_PAGE_SIZE));
  const range = rangeLabel(query, today);
  const first = (query.page - 1) * ARCHIVE_PAGE_SIZE + 1;
  const last = first + archive.items.length - 1;
  // 주제 칩: 분야 전체 + 세부 주제. 고른 기간은 그대로 두고 1쪽부터
  const topics: { name: string; href: string; on: boolean }[] = [
    { name: `${group.name} 전체`, href: archiveHref(archivePath(group), { ...query, page: 1 }), on: !detail },
    ...detailsOf(group).map((d) => ({ name: d.name, href: archiveHref(archivePath(d), { ...query, page: 1 }), on: d.id === detail?.id })),
  ];

  return (
    <PublicPage>
      <ArchiveJsonLd topic={topic} archive={archive} query={query} />
      <div className="mx-auto max-w-[760px] px-5 pt-6">
        <nav aria-label="현재 위치" className="text-[13px] font-bold text-sub">
          <ol className="flex flex-wrap items-center gap-1.5">
            {crumbs(topic).map((c, i) => (
              <li key={c.name} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                <Link href={c.href} className="text-sub no-underline hover:text-ink hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              지난 소식
            </li>
          </ol>
        </nav>

        <header className="mt-8">
          <TopicGroupIcon id={group.id} className="size-14 rounded-2xl" iconClassName="size-8" />
          <h1 className="mt-4 text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">{topic.name} 지난 소식</h1>
          <p className="mt-4 text-[17px] font-medium leading-relaxed text-sub">
            맹고가 지금까지 요약한 {topic.name} 소식을 최신순으로 모았어요. 소식마다 두 줄 요약과 원문 링크가 있고, 기간을 골라 찾아볼 수 있어요.
          </p>
        </header>

        {topics.length > 1 && (
          <nav aria-label="주제로 좁히기" className="-mx-5 mt-8 overflow-x-auto px-5 [scrollbar-width:none]">
            <ul className="flex w-max gap-2">
              {topics.map((t) => (
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
        )}

        <section aria-label="기간으로 찾기" className="tile mt-4 flex flex-col gap-3 p-4">
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
                    <Link href={archiveHref(base, { page: 1, from: p.from, to: p.to })} className={chipOff}>
                      {p.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {/* 날짜 직접: 폼을 보내면 1쪽부터(쪽 번호는 넣지 않는다). 기간을 바꾸면 칸도 새 값으로 다시 그린다 */}
          <form key={`${query.from}~${query.to}`} action={withBase(base)} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 max-[359px]:grid-cols-1 sm:flex">
            <label htmlFor="archive-from" className="sr-only">
              시작일
            </label>
            <input id="archive-from" type="date" name="from" defaultValue={query.from} max={today} className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
            <span aria-hidden="true" className="font-bold text-faint max-[359px]:hidden">
              ~
            </span>
            <label htmlFor="archive-to" className="sr-only">
              종료일
            </label>
            <input id="archive-to" type="date" name="to" defaultValue={query.to} max={today} className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
            <button type="submit" className="btn btn-ink col-span-full min-h-11 shrink-0 px-5 text-[15px]">
              찾기
            </button>
          </form>
        </section>

        <section aria-labelledby="archive-title" className="mt-10">
          <h2 id="archive-title" className="text-[22px] font-black tracking-[-0.03em] md:text-[26px]">
            {range ? `${range} ${topic.name} 소식` : `${topic.name} 소식 전체`} <span className="text-mango-deep">{archive.total.toLocaleString("ko-KR")}개</span>
          </h2>
          {archive.items.length > 0 && (
            <p className="mt-1 text-[14px] font-semibold text-sub">
              최신순 · {first}~{last}번째{pages > 1 ? ` · ${query.page}/${pages}쪽` : ""}
            </p>
          )}
          {archive.items.length > 0 ? (
            <ol className="mt-6 flex flex-col gap-3">
              {archive.items.map((it) => (
                <TopicItem key={it.clusterId} item={it} />
              ))}
            </ol>
          ) : (
            <p className="tile mt-6 p-5 text-[15px] font-semibold text-sub">
              {range ? `이 기간에 요약한 ${topic.name} 소식이 없어요. 기간을 넓혀 보세요.` : `아직 요약한 ${topic.name} 소식이 없어요. 내일 아침에 다시 모아요.`}
            </p>
          )}
        </section>

        {pages > 1 && <Pager base={base} query={query} pages={pages} />}

        <p className="mt-10">
          <Link href={detail ? detailPath(detail) : topicsPath(group.slug)} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-extrabold text-sky-dark no-underline hover:underline">
            {detail ? `최근 30일 ${topic.name} 소식, 맹고가 고른 순서로 보기` : `이번 주 ${topic.name} 소식, 맹고가 고른 순서로 보기`}
            <IconChevronRight className="size-4" />
          </Link>
        </p>
      </div>

      <StartBand title={`${topic.name} 소식, 이제 귀로 들어 보세요`} body="맹고 앱은 고른 분야 소식만 매일 아침 모아 AI 음성으로 읽어 줘요. Premium이면 하루 소식을 끝까지 이어서 들어요." />
    </PublicPage>
  );
}

function crumbs(topic: PublicTopic | PublicDetail): { name: string; href: string }[] {
  const out = [
    { name: SITE_NAME, href: "/" },
    { name: "1분 요약", href: topicsPath() },
  ];
  if ("group" in topic) out.push({ name: topic.group.name, href: topicsPath(topic.group.slug) }, { name: topic.name, href: detailPath(topic) });
  else out.push({ name: topic.name, href: topicsPath(topic.slug) });
  return out;
}

/** 쪽 넘기기: ‹ 이전 · 1 … 4 5 [6] 7 8 … 20 · 다음 › */
function Pager({ base, query, pages }: { base: string; query: ArchiveQuery; pages: number }) {
  const at = (page: number) => archiveHref(base, { ...query, page });
  const box = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[15px] font-extrabold tabular-nums no-underline";
  return (
    <nav aria-label="쪽 넘기기" className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {query.page > 1 ? (
            <Link href={at(query.page - 1)} rel="prev" className={`${box} gap-0.5 text-ink hover:bg-snow`}>
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
        {pageWindow(query.page, pages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 font-bold text-faint">
              …
            </li>
          ) : (
            <li key={p}>
              {p === query.page ? (
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
          {query.page < pages ? (
            <Link href={at(query.page + 1)} rel="next" className={`${box} gap-0.5 text-ink hover:bg-snow`}>
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

/** 검색엔진용: 이 쪽(모음), 위치(맹고 > 1분 요약 > 분야 > (주제) > 지난 소식), 이 쪽의 소식 목록(원문 주소) */
function ArchiveJsonLd({ topic, archive, query }: { topic: PublicTopic | PublicDetail; archive: PublicArchive; query: ArchiveQuery }) {
  const url = appUrl(archiveHref(archivePath(topic), query));
  const trail = [...crumbs(topic), { name: "지난 소식", href: archivePath(topic) }];
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${topic.name} 지난 소식`,
          url,
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          about: { "@type": "Thing", name: topic.name },
          mainEntity: {
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: archive.items.length,
            itemListElement: archive.items.map((it, i) => ({ "@type": "ListItem", position: (query.page - 1) * ARCHIVE_PAGE_SIZE + i + 1, name: it.title, url: it.url })),
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: appUrl(c.href) })),
        },
      ]}
    />
  );
}

/** 분야·세부 주제 페이지에서 지난 소식으로 가는 카드 */
export function ArchiveLinkCard({ topic, total }: { topic: PublicTopic | PublicDetail; total: number }) {
  return (
    <Link href={archivePath(topic)} className="tile mt-4 flex items-center gap-4 p-5 no-underline hover:border-line-dark">
      <span className="flex-1">
        <span className="block text-[17px] font-black">{topic.name} 지난 소식 모아 보기</span>
        <span className="mt-1 block text-[14px] font-semibold text-sub">
          지금까지 요약한 {topic.name} 소식 {total.toLocaleString("ko-KR")}개를 최신순으로 봐요. 기간을 골라 찾을 수도 있어요.
        </span>
      </span>
      <IconChevronRight className="size-5 shrink-0 text-sub" />
    </Link>
  );
}
