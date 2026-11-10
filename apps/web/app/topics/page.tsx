import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemListLd, listMetadata, NewsList } from "@/components/public/NewsList";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { kstToday, parseArchiveQuery } from "@/lib/public-archive";
import { detailsLine, NEWS_SECTION_NAMES, PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import { publicArchive } from "@/lib/server/public-topics";
import { appUrl, organizationId } from "@/lib/site";

// 1분 요약(머리 메뉴, 2026-11-10 사용자: '관심 분야 선택하는게 너무 길어. … 바로 보여지게해' → 이름은 요약된 소식이라는 게 보이게 '1분 요약'으로, 같은 날 A안).
// 공개 분야 다섯 개의 소식 전부를 최신순 목록 하나로(같은 날 '이번주, 지난 주 구분하지말고 전체 리스트 하나로', components/public/NewsList.tsx).
// 목록엔 제목·한 줄 요약·출처·원문 링크, 카드를 누르면 1분 요약 전체 글(/s/<토큰>). 쪽·기간이 주소(?page=&from=&to=)에 있어 요청마다 그리고,
// 목록은 public-topics.ts가 한 시간 들고 있다. 분야 카드는 아래에
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "AI·주식·코인·반도체 뉴스 1분 요약";
const DESCRIPTION = `맹고가 AI로 요약한 ${PUBLIC_TOPICS.map((t) => t.name).join(", ")} 소식을 최신순으로 모두 모았어요. 소식마다 두 줄 요약과 원문 링크가 있고, 누르면 1분 요약 전체를 읽을 수 있어요.`;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listMetadata(null, { title: TITLE, description: DESCRIPTION }, parseArchiveQuery(await searchParams));
}

export default async function TopicsPage({ searchParams }: Props) {
  const query = parseArchiveQuery(await searchParams);
  const archive = await publicArchive(null, query);
  if (query.page > 1 && archive.items.length === 0) notFound();
  return (
    <PublicPage>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "1분 요약",
          url: appUrl(topicsPath()),
          description: DESCRIPTION,
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          hasPart: PUBLIC_TOPICS.map((t) => ({ "@type": "CollectionPage", name: `${t.name} 소식`, url: appUrl(topicsPath(t.slug)) })),
          mainEntity: itemListLd(archive, query),
        }}
      />
      <div className="mx-auto max-w-[760px] px-5 pt-10 md:pt-14">
        <h1 className="text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">1분 요약</h1>
        <p className="mt-3 text-[16px] font-medium leading-relaxed text-sub md:text-[17px]">
          맹고가 요약한 소식을 최신순으로 모두 모았어요. 소식을 누르면 1분 요약 전체를 읽을 수 있어요.
        </p>

        <div className="mt-6">
          <NewsList scope={null} archive={archive} query={query} today={kstToday()} />
        </div>

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
      </div>

      <StartBand title="내 관심 소식만 매일 받아 보세요" body="관심 분야만 고르면 첫 소식을 바로 보여 드려요. 출퇴근길엔 귀로 들어요." />
    </PublicPage>
  );
}
