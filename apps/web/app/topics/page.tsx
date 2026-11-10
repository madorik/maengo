import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_ARCHIVE_HASH, ALL_ARCHIVE_ID, allArchiveChips, ArchiveSection } from "@/components/public/ArchiveView";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { dayLabel, TopicItem } from "@/components/public/TopicItem";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { archiveHref, isFiltered, kstToday, parseArchiveQuery } from "@/lib/public-archive";
import { detailsLine, NEWS_SECTION_NAMES, PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import { publicArchive, publicMixedDigest } from "@/lib/server/public-topics";
import { APP_STORE_ID, SITE_NAME, appUrl, ogImages, organizationId } from "@/lib/site";

// 1분 요약(머리 메뉴, 2026-11-10 사용자: '관심 분야 선택하는게 너무 길어. … 바로 보여지게해' → 이름은 요약된 소식이라는 게 보이게 '1분 요약'으로, 같은 날 A안).
// 들어오면 분야를 고르지 않아도 이번 주 소식이 바로 보인다(공개 분야 5개를 번갈아 12개). 분야로 좁히는 칩은 위에, 분야 카드는 아래에.
// 공개 원칙은 분야 페이지와 같다: 목록엔 제목·한 줄 요약·출처·원문 링크, 카드를 누르면 1분 요약 전체 글(/s/<토큰>).
// 맨 아래엔 모든 분야의 지난 소식을 최신순으로 쪽마다 20개(2026-11-10 사용자 '그냥 전체 보여지게해'). 쪽·기간이 주소(?page=&from=&to=)에 있어
// 요청마다 그리고, 이번 주 목록·지난 소식은 public-topics.ts가 한 시간씩 들고 있다
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "AI·주식·코인·반도체 뉴스 요약, 이번 주 소식";
const DESCRIPTION = `맹고가 이번 주에 고른 ${PUBLIC_TOPICS.map((t) => t.name).join(", ")} 소식을 한곳에서 봐요. 분야마다 이슈도가 높은 소식을 AI가 핵심만 요약하고 원문 링크를 붙였어요.`;

/** 지난 소식 쪽만 넘긴 주소(?page=2)는 그 주소가 대표 주소, 기간을 고른 주소는 noindex(지난 소식 페이지와 같은 규칙) */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseArchiveQuery(await searchParams);
  const title = query.page > 1 ? `${TITLE} ${query.page}쪽` : TITLE;
  const url = appUrl(isFiltered(query) ? topicsPath() : archiveHref(topicsPath(), { page: query.page }));
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: url },
    robots: isFiltered(query) ? { index: false, follow: true } : undefined,
    itunes: { appId: APP_STORE_ID },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description: DESCRIPTION, url, images: ogImages() },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description: DESCRIPTION, images: ogImages() },
  };
}

const chip = "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[15px] font-extrabold no-underline";

export default async function TopicsPage({ searchParams }: Props) {
  const query = parseArchiveQuery(await searchParams);
  const [{ items, updatedAt }, archive] = await Promise.all([publicMixedDigest(12), publicArchive(null, query)]);
  if (query.page > 1 && archive.items.length === 0) notFound();
  return (
    <PublicPage>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "이번 주 1분 요약",
          url: appUrl(topicsPath()),
          description: DESCRIPTION,
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          hasPart: PUBLIC_TOPICS.map((t) => ({ "@type": "CollectionPage", name: `${t.name} 소식`, url: appUrl(topicsPath(t.slug)) })),
          mainEntity: {
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: items.length,
            itemListElement: items.map(({ item }, i) => ({ "@type": "ListItem", position: i + 1, name: item.title, url: item.url })),
          },
        }}
      />
      <div className="mx-auto max-w-[760px] px-5 pt-10 md:pt-14">
        <h1 className="text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">이번 주 1분 요약</h1>
        <p className="mt-3 text-[16px] font-medium leading-relaxed text-sub md:text-[17px]">
          분야마다 이슈도가 높은 소식만 골라, 하나를 1분 안에 읽을 수 있게 핵심만 추렸어요.{updatedAt ? ` ${dayLabel(updatedAt)} 업데이트.` : ""}
        </p>

        {/* 분야로 좁히기: '전체'가 지금 화면, 나머지는 분야 페이지로. 고른 칩은 망고 바탕에 남색 글자로 고정(다크 모드에서 ink가 밝아져 흰 글자가 묻히던 것, 2026-11-10) */}
        <nav aria-label="분야로 좁히기" className="-mx-5 mt-6 overflow-x-auto px-5 [scrollbar-width:none]">
          <ul className="flex w-max gap-2">
            <li>
              <span aria-current="page" className={`${chip} bg-mango text-[#1F2340]`}>
                전체
              </span>
            </li>
            {PUBLIC_TOPICS.map((t) => (
              <li key={t.slug}>
                <Link href={topicsPath(t.slug)} className={`${chip} bg-snow text-ink hover:bg-line`}>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {items.length > 0 ? (
          <ol className="mt-6 flex flex-col gap-3" aria-label="이번 주 1분 요약">
            {items.map(({ item, topic }) => (
              <TopicItem key={item.clusterId} item={item} label={topic.name} />
            ))}
          </ol>
        ) : (
          <p className="tile mt-6 p-5 text-[15px] font-semibold text-sub">이번 주에 고른 소식이 아직 없어요. 내일 아침에 다시 모아요.</p>
        )}

        <section aria-labelledby="fields-title" className="mt-16">
          <h2 id="fields-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
            분야별로 보기
          </h2>
          <p className="mt-1 text-[15px] font-medium text-sub">관심 있는 분야만 고르면, 그 분야 소식만 매일 아침 받아요. 분야 안의 세부 주제로 더 좁힐 수도 있어요.</p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {PUBLIC_TOPICS.map((t) => (
              <li key={t.slug}>
                <Link href={topicsPath(t.slug)} className="tile flex h-full flex-col gap-2 p-5 no-underline hover:border-line-dark">
                  <span className="flex items-center gap-3">
                    <TopicGroupIcon id={t.id} />
                    <span className="text-[20px] font-black tracking-[-0.03em]">{t.name}</span>
                  </span>
                  <span className="text-[14px] font-medium leading-relaxed text-sub">{detailsLine(t)}</span>
                </Link>
              </li>
            ))}
            {/* 뉴스 분야는 공개 페이지가 없어 링크 없이 이름만(언론사 헤드라인이라 목록을 공개하지 않는다) */}
            <li className="tile flex flex-col gap-2 p-5">
              <span className="flex items-center gap-3">
                <TopicGroupIcon id="politics" />
                <span className="text-[20px] font-black tracking-[-0.03em]">뉴스 분야</span>
              </span>
              <span className="text-[14px] font-medium leading-relaxed text-sub">{NEWS_SECTION_NAMES.join(", ")}</span>
              <span className="text-[13px] font-semibold text-sub">여러 언론사가 함께 다룬 헤드라인 소식만 골라요. 이 분야 소식은 맹고에서 볼 수 있어요.</span>
            </li>
          </ul>
          <p className="mt-5 text-[14px] font-semibold text-sub">목록에 없는 관심사는 Premium에서 직접 적을 수 있어요.</p>
        </section>

        {/* 지난 소식(2026-11-10 사용자 '그냥 전체 보여지게해'): 모든 분야를 최신순으로. 칩은 분야별 지난 소식으로 */}
        <section id={ALL_ARCHIVE_ID} aria-labelledby="archive-heading" className="mt-16 scroll-mt-20">
          <h2 id="archive-heading" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
            지난 소식
          </h2>
          <p className="mt-1 text-[15px] font-medium text-sub">지금까지 요약한 소식을 모두 모았어요. 소식을 누르면 1분 요약 전체를 읽을 수 있어요.</p>
          <div className="mt-6">
            <ArchiveSection base={topicsPath()} hash={ALL_ARCHIVE_HASH} heading="h3" chips={allArchiveChips(query)} archive={archive} query={query} today={kstToday()} />
          </div>
        </section>
      </div>

      <StartBand title="내 관심 소식만 매일 받아 보세요" body="관심 분야만 고르면 첫 소식을 바로 보여 드려요. 출퇴근길엔 귀로 들어요." />
    </PublicPage>
  );
}
