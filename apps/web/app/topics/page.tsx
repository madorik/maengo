import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { detailsLine, NEWS_SECTION_NAMES, PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import { SITE_NAME, appUrl, ogImages, organizationId } from "@/lib/site";

// 관심 분야 목록. 분야 페이지로 들어가는 길이고, '맹고에서 무엇을 고를 수 있나'에 답한다. 사전 값만 쓰는 정적 페이지다.

const TITLE = "관심 분야";
const DESCRIPTION = `맹고에서 고를 수 있는 관심 분야예요. ${[...PUBLIC_TOPICS.map((t) => t.name), ...NEWS_SECTION_NAMES].join(", ")} 중에서 고르면, 그 분야 소식만 매일 아침 AI로 요약해서 음성 지원해줘요.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: appUrl(topicsPath()) },
  openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: appUrl(topicsPath()), images: ogImages() },
  twitter: { card: "summary_large_image", title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, images: ogImages() },
};

export default function TopicsPage() {
  return (
    <PublicPage>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${SITE_NAME} ${TITLE}`,
          url: appUrl(topicsPath()),
          description: DESCRIPTION,
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: PUBLIC_TOPICS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: `${t.name} 소식`, url: appUrl(topicsPath(t.slug)) })),
          },
        }}
      />
      <div className="mx-auto max-w-[880px] px-5 pt-12 md:pt-16">
        <h1 className="text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">맹고 관심 분야</h1>
        <p className="mt-4 max-w-[620px] text-[17px] font-medium leading-relaxed text-sub">
          관심 있는 분야만 고르면, 그 분야 소식만 매일 아침 AI로 요약해서 음성 지원해줘요. 분야 안의 세부 관심사를 고르면 더 좁혀 받을 수 있어요.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {PUBLIC_TOPICS.map((t) => (
            <li key={t.slug}>
              <Link href={topicsPath(t.slug)} className="tile flex h-full flex-col gap-3 p-6 no-underline hover:border-line-dark">
                <span className="flex items-center gap-3">
                  <TopicGroupIcon id={t.id} />
                  <span className="text-[22px] font-black tracking-[-0.03em]">{t.name}</span>
                </span>
                <span className="text-[15px] font-medium leading-relaxed text-sub">{detailsLine(t)}</span>
                <span className="mt-auto text-[14px] font-extrabold text-sky-dark">이번 주 {t.name} 소식 보기</span>
              </Link>
            </li>
          ))}
          {/* 뉴스 분야는 공개 페이지가 없어 링크 없이 이름만(언론사 헤드라인이라 목록을 공개하지 않는다) */}
          <li className="tile flex flex-col gap-3 p-6">
            <span className="flex items-center gap-3">
              <TopicGroupIcon id="politics" />
              <span className="text-[22px] font-black tracking-[-0.03em]">뉴스 분야</span>
            </span>
            <span className="text-[15px] font-medium leading-relaxed text-sub">{NEWS_SECTION_NAMES.join(", ")}</span>
            <span className="mt-auto text-[14px] font-semibold text-sub">여러 언론사가 함께 다룬 헤드라인 소식만 골라요. 이 분야 소식은 맹고에서 볼 수 있어요.</span>
          </li>
        </ul>


        <p className="mt-6 text-[15px] font-semibold text-sub">목록에 없는 관심사는 Premium에서 직접 적을 수 있어요.</p>
      </div>

      <StartBand title="관심 분야를 고르고 시작해요" body="고른 분야의 첫 소식을 바로 보여 드려요. Premium이면 음성으로도 들어요." />
    </PublicPage>
  );
}
