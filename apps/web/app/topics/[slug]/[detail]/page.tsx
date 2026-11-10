import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveLinkCard } from "@/components/public/ArchiveView";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { dayLabel, TopicItem } from "@/components/public/TopicItem";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { detailPath, detailsOf, PUBLIC_DETAILS, publicDetailBySlug, topicsPath, type PublicDetail } from "@/lib/public-topics";
import { DETAIL_MIN_ITEMS, publicArchive, publicDetailDigest, publicDetailStats, type PublicTopicItem } from "@/lib/server/public-topics";
import { APP_STORE_ID, SITE_NAME, appUrl, ogImages, organizationId } from "@/lib/site";

// 세부 주제 페이지(2026-11-10 사용자 결정 '주제별로 하나씩 만들어서 검색 유입 늘리자', 맹고-문서/검색-노출.md).
// 분야 페이지와 같은 공개 원칙: 제목·한 줄 요약·출처·원문 링크만, 다시 쓴 전체 글은 없다. 주제 하나는 소식이 적어 지난 30일에서 고른다.
// 검색어는 제목·설명·키워드에만 '뉴스 요약'을 쓰고 화면 문구는 '소식'(용어 정책). 소식이 DETAIL_MIN_ITEMS개보다 적으면 noindex(사이트맵에도 안 넣음).
// 분야 페이지처럼 dynamicParams는 막지 않는다(없는 주소는 notFound)
export const revalidate = 3600;

export function generateStaticParams() {
  return PUBLIC_DETAILS.map((d) => ({ slug: d.group.slug, detail: d.slug }));
}

type Props = { params: Promise<{ slug: string; detail: string }> };

const title = (d: PublicDetail) => `${d.name} 뉴스 요약, 최근 30일 주요 소식`;
const description = (d: PublicDetail) =>
  `${d.name}${d.aliases.length ? `(${d.aliases.slice(0, 3).join(", ")})` : ""} 소식을 AI가 핵심만 짧게 요약해요. 맹고가 최근 30일 동안 고른 ${d.name} 주요 뉴스를 원문 링크와 함께 모았어요.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, detail } = await params;
  const d = publicDetailBySlug(slug, detail);
  if (!d) return {};
  const url = appUrl(detailPath(d));
  const count = (await publicDetailStats()).get(d.id)?.count ?? 0;
  return {
    title: title(d),
    description: description(d),
    keywords: [`${d.name} 뉴스`, `${d.name} 뉴스 요약`, `${d.name} 소식`, ...d.aliases.slice(0, 6)],
    alternates: { canonical: url },
    robots: count >= DETAIL_MIN_ITEMS ? undefined : { index: false, follow: true },
    itunes: { appId: APP_STORE_ID },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${title(d)} | ${SITE_NAME}`, description: description(d), url, images: ogImages() },
    twitter: { card: "summary_large_image", title: `${title(d)} | ${SITE_NAME}`, description: description(d), images: ogImages() },
  };
}

export default async function DetailPage({ params }: Props) {
  const { slug, detail } = await params;
  const d = publicDetailBySlug(slug, detail);
  if (!d) notFound();
  const [{ items, sources, updatedAt }, archive] = await Promise.all([publicDetailDigest(d), publicArchive(d, { page: 1 })]);
  const siblings = detailsOf(d.group).filter((x) => x.id !== d.id);

  return (
    <PublicPage>
      <DetailJsonLd detail={d} items={items} />
      <div className="mx-auto max-w-[760px] px-5 pt-6">
        <nav aria-label="현재 위치" className="text-[13px] font-bold text-sub">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="text-sub no-underline hover:text-ink hover:underline">
                맹고
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={topicsPath()} className="text-sub no-underline hover:text-ink hover:underline">
                1분 요약
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={topicsPath(d.group.slug)} className="text-sub no-underline hover:text-ink hover:underline">
                {d.group.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              {d.name}
            </li>
          </ol>
        </nav>

        <header className="mt-8">
          <TopicGroupIcon id={d.group.id} className="size-14 rounded-2xl" iconClassName="size-8" />
          <h1 className="mt-4 text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">{d.name} 소식</h1>
          <p className="mt-4 text-[17px] font-medium leading-relaxed text-sub">
            맹고에서는 {d.group.name} 분야 안의 {d.name} 소식만 따로 골라 받을 수 있어요. 국내외 매체와 공식 블로그에서 새 글을 모아 같은 소식은 하나로 묶고, AI가 핵심만
            요약해요. 영어로 나온 소식도 한국어로 요약하고, 모든 소식에 원문 링크가 붙어요.
          </p>
          {d.aliases.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-extrabold text-faint">이런 소식도 함께 다뤄요</p>
              <ul aria-label={`${d.name}와 함께 다루는 말`} className="mt-2 flex flex-wrap gap-2">
                {d.aliases.map((a) => (
                  <li key={a} className="rounded-xl bg-snow px-3 py-1.5 text-[14px] font-bold">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <section aria-labelledby="recent-title" className="mt-14">
          <h2 id="recent-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
            최근 30일 {d.name} 소식
          </h2>
          <p className="mt-1 text-[14px] font-semibold text-sub">{updatedAt ? `맹고가 고른 순서예요 · ${dayLabel(updatedAt)} 업데이트` : "맹고가 고른 순서예요"}</p>
          {items.length > 0 ? (
            <ol className="mt-6 flex flex-col gap-3">
              {items.map((it) => (
                <TopicItem key={it.clusterId} item={it} />
              ))}
            </ol>
          ) : (
            <p className="tile mt-6 p-5 text-[15px] font-semibold text-sub">최근 30일 동안 고른 {d.name} 소식이 아직 없어요. 내일 아침에 다시 모아요.</p>
          )}
          {archive.total > items.length && <ArchiveLinkCard topic={d} total={archive.total} />}
        </section>

        {sources.length > 0 && (
          <section aria-labelledby="sources-title" className="mt-14">
            <h2 id="sources-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
              {d.name} 소식을 모으는 곳
            </h2>
            <p className="mt-1 text-[14px] font-semibold text-sub">지난 30일 동안 이 주제 소식을 많이 낸 순서예요.</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {sources.map((s) => (
                <li key={s} className="rounded-xl bg-snow px-3 py-1.5 text-[14px] font-bold">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-labelledby="siblings-title" className="mt-14">
          <h2 id="siblings-title" className="text-[20px] font-black tracking-[-0.03em]">
            {d.group.name}의 다른 주제
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {siblings.map((x) => (
              <li key={x.id}>
                <Link href={detailPath(x)} className="tile inline-flex min-h-11 items-center px-4 text-[15px] font-black no-underline hover:border-line-dark">
                  {x.name} 소식
                </Link>
              </li>
            ))}
            <li>
              <Link href={topicsPath(d.group.slug)} className="tile inline-flex min-h-11 items-center px-4 text-[15px] font-black text-sky-dark no-underline hover:border-line-dark">
                {d.group.name} 소식 전체
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <StartBand title={`${d.name} 소식만 골라 매일 받아 보세요`} body={`설정에서 ${d.name}만 골라 두면 그 주제 소식만 와요. 바쁠 땐 음성으로 들어요.`} />
    </PublicPage>
  );
}

/** 검색엔진용: 이 페이지(모음), 위치(맹고 > 1분 요약 > 분야 > 주제), 소식 목록(원문 주소) */
function DetailJsonLd({ detail: d, items }: { detail: PublicDetail; items: PublicTopicItem[] }) {
  const url = appUrl(detailPath(d));
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${d.name} 소식`,
          url,
          description: description(d),
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          about: { "@type": "Thing", name: d.name, ...(d.aliases.length ? { alternateName: d.aliases } : {}) },
          mainEntity: {
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: items.length,
            itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.title, url: it.url })),
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: appUrl("/") },
            { "@type": "ListItem", position: 2, name: "1분 요약", item: appUrl(topicsPath()) },
            { "@type": "ListItem", position: 3, name: d.group.name, item: appUrl(topicsPath(d.group.slug)) },
            { "@type": "ListItem", position: 4, name: d.name, item: url },
          ],
        },
      ]}
    />
  );
}
