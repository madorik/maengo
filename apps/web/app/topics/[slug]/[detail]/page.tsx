import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemListLd, listMetadata, NewsList } from "@/components/public/NewsList";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { RecentGlance, TopicIntro } from "@/components/public/TopicGlance";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { kstToday, parseArchiveQuery, type ArchiveQuery } from "@/lib/public-archive";
import { detailPath, publicDetailBySlug, topicsPath, type PublicDetail } from "@/lib/public-topics";
import { topicBlurb, topicMetaDescription } from "@/lib/public-topic-blurbs";
import { DETAIL_MIN_ITEMS, publicArchive, publicDetailDigest, type PublicArchive } from "@/lib/server/public-topics";
import { SITE_NAME, appUrl, organizationId } from "@/lib/site";

// 세부 주제 페이지(2026-11-10 사용자 결정 '주제별로 하나씩 만들어서 검색 유입 늘리자', 맹고-문서/검색-노출.md).
// 분야 페이지와 같은 공개 원칙과 모양: 이 주제 소식 전부를 최신순 목록 하나로(2026-11-10 사용자 '이번주, 지난 주 구분하지말고 전체 리스트 하나로'),
// 카드를 누르면 1분 요약 전체 글. 검색어는 제목·설명·키워드에만 '뉴스 요약'을 쓰고 화면 문구는 '소식'(용어 정책).
// 이 주제 소식이 모두 DETAIL_MIN_ITEMS개보다 적으면 noindex(사이트맵은 지난 30일 기준). 분야 페이지처럼 dynamicParams는 막지 않는다(없는 주소는 notFound)
type Props = { params: Promise<{ slug: string; detail: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const title = (d: PublicDetail) => `${d.name} 뉴스 요약 모음, 최신 소식`;
// 설명: 주제마다 손으로 쓴 설명의 첫 문장(lib/public-topic-blurbs.ts, 2026-11-26 사용자: 서치 콘솔 '색인 안 됨' → 주제마다 고유한 내용). 쪽을 넘긴 주소는 쪽 번호가 붙는다
const description = (d: PublicDetail, page = 1) => topicMetaDescription(d.id, d.name, page);

async function load({ params, searchParams }: Props) {
  const { slug, detail } = await params;
  const d = publicDetailBySlug(slug, detail);
  if (!d) notFound();
  const query = parseArchiveQuery(await searchParams);
  const archive = await publicArchive(d, query);
  if (query.page > 1 && archive.items.length === 0) notFound();
  return { d, query, archive };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { d, query, archive } = await load(props);
  return listMetadata(
    d,
    { title: title(d), description: description(d, query.page), keywords: [`${d.name} 뉴스`, `${d.name} 뉴스 요약`, `${d.name} 소식`, ...d.aliases.slice(0, 6)] },
    query,
    archive.total < DETAIL_MIN_ITEMS,
  );
}

export default async function DetailPage(props: Props) {
  const { d, query, archive } = await load(props);
  const { sources, month } = await publicDetailDigest(d);

  return (
    <PublicPage>
      <DetailJsonLd detail={d} archive={archive} query={query} />
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
          <TopicIntro blurb={topicBlurb(d.id, d.name)} />
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

        {/* 최근 30일 한눈에: 소식이 적으면(30일 3개 미만) 숨긴다 */}
        {month && <RecentGlance name={d.name} month={month} />}

        {/* 소식 목록. 위 칩으로 같은 분야의 다른 주제·분야 전체로 옮긴다 */}
        <div className="mt-10">
          <NewsList scope={d} archive={archive} query={query} today={kstToday()} />
        </div>

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
      </div>

      <StartBand title={`${d.name} 소식도 출퇴근길에 받아 보세요`} body={`${d.name} 소식을 자주 읽고 들으면 맹고가 그 소식을 더 챙겨 드려요. 바쁠 땐 음성으로 들어요.`} />
    </PublicPage>
  );
}

/** 검색엔진용: 이 페이지(모음), 위치(맹고 > 1분 요약 > 분야 > 주제), 이 쪽의 소식 목록(원문 주소) */
function DetailJsonLd({ detail: d, archive, query }: { detail: PublicDetail; archive: PublicArchive; query: ArchiveQuery }) {
  const url = appUrl(detailPath(d));
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${d.name} 소식`,
          url,
          description: description(d, query.page),
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          about: { "@type": "Thing", name: d.name, ...(d.aliases.length ? { alternateName: d.aliases } : {}) },
          mainEntity: itemListLd(archive, query),
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
