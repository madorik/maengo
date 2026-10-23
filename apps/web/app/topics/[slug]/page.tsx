import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconDoc, IconExternal, IconPlay } from "@/components/icons";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { detailsLine, PUBLIC_TOPICS, publicTopicBySlug, topicsPath, type PublicTopic } from "@/lib/public-topics";
import { publicTopicDigest, type PublicTopicItem } from "@/lib/server/public-topics";
import { SITE_NAME, appUrl, ogImages, organizationId } from "@/lib/site";

// 공개 분야 페이지. 지난 7일 이 분야 소식(제목·한 줄 요약·원문 링크)과 출처를 보여 준다.
// 수집은 하루 한 번(06시)이지만 요약은 그 뒤로도 이어지므로 한 시간마다 새로 그린다.
// 없는 분야는 아래 notFound()가 404로 답한다. dynamicParams = false로 막으면 basePath 밖 주소를 /maengo로 넘기는
// next.config.ts의 리다이렉트와 엮여 같은 주소로 끝없이 307을 낸다(2026-10-18 확인)
export const revalidate = 3600;

export function generateStaticParams() {
  return PUBLIC_TOPICS.map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const title = (t: PublicTopic) => `${t.name} 소식, 매일 아침 요약`;
const description = (t: PublicTopic) =>
  `${t.name} 분야(${detailsLine(t, 4)}) 소식을 매일 아침 AI로 요약해서 음성 지원해줘요. 지난 7일 동안 맹고가 고른 ${t.name} 소식과 출처를 모았어요.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = publicTopicBySlug((await params).slug);
  if (!topic) return {};
  const url = appUrl(topicsPath(topic.slug));
  return {
    title: title(topic),
    description: description(topic),
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: `${title(topic)} | ${SITE_NAME}`, description: description(topic), url, images: ogImages() },
    twitter: { card: "summary_large_image", title: `${title(topic)} | ${SITE_NAME}`, description: description(topic), images: ogImages() },
  };
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

export default async function TopicPage({ params }: Props) {
  const topic = publicTopicBySlug((await params).slug);
  if (!topic) notFound();
  const { items, sources, updatedAt } = await publicTopicDigest(topic);
  const others = PUBLIC_TOPICS.filter((t) => t.slug !== topic.slug);

  return (
    <PublicPage>
      <TopicJsonLd topic={topic} items={items} />
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
                관심 분야
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              {topic.name}
            </li>
          </ol>
        </nav>

        <header className="mt-8">
          <TopicGroupIcon id={topic.id} className="size-14 rounded-2xl" iconClassName="size-8" />
          <h1 className="mt-4 text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">{topic.name} 소식</h1>
          <p className="mt-4 text-[17px] font-medium leading-relaxed text-sub">
            맹고의 {topic.name} 분야는 {detailsLine(topic)} 소식을 다뤄요. 매일 아침 6시에 국내외 매체와 공식 블로그에서 새 글을 모아 같은 소식은 하나로 묶고, AI로 요약해서 음성
            지원해줘요.
          </p>
          {topic.details.length > 0 && (
            <ul aria-label={`${topic.name} 세부 관심사`} className="mt-5 flex flex-wrap gap-2">
              {topic.details.map((d) => (
                <li key={d} className="rounded-xl bg-snow px-3 py-1.5 text-[14px] font-extrabold">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </header>

        <section aria-labelledby="recent-title" className="mt-14">
          <h2 id="recent-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
            지난 7일 {topic.name} 소식
          </h2>
          <p className="mt-1 text-[14px] font-semibold text-sub">{updatedAt ? `맹고가 고른 순서예요 · ${dayLabel(updatedAt)} 업데이트` : "맹고가 고른 순서예요"}</p>
          {items.length > 0 ? (
            <ol className="mt-6 flex flex-col gap-3">
              {items.map((it) => (
                <TopicItem key={it.clusterId} item={it} />
              ))}
            </ol>
          ) : (
            <p className="tile mt-6 p-5 text-[15px] font-semibold text-sub">이번 주에 고른 {topic.name} 소식이 아직 없어요. 내일 아침에 다시 모아요.</p>
          )}
        </section>

        {sources.length > 0 && (
          <section aria-labelledby="sources-title" className="mt-14">
            <h2 id="sources-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
              {topic.name} 소식을 모으는 곳
            </h2>
            <p className="mt-1 text-[14px] font-semibold text-sub">지난 30일 동안 이 분야 소식을 많이 낸 순서예요.</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {sources.map((s) => (
                <li key={s} className="rounded-xl bg-snow px-3 py-1.5 text-[14px] font-bold">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-labelledby="others-title" className="mt-14">
          <h2 id="others-title" className="text-[20px] font-black tracking-[-0.03em]">
            다른 관심 분야
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {others.map((t) => (
              <li key={t.slug}>
                <Link href={topicsPath(t.slug)} className="tile flex min-h-14 items-center gap-3 px-4 py-3 no-underline hover:border-line-dark">
                  <TopicGroupIcon id={t.id} className="size-9 rounded-xl" iconClassName="size-5" />
                  <span className="text-[16px] font-black">{t.name} 소식</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <StartBand title={`${topic.name} 소식을 매일 아침 받아 보세요`} body="관심 분야만 고르면 첫 소식을 바로 보여 드려요. Premium이면 음성으로도 들어요." />
    </PublicPage>
  );
}

function TopicItem({ item: it }: { item: PublicTopicItem }) {
  const video = it.kind === "video";
  return (
    <li className="tile p-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-extrabold">
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 ${video ? "bg-[#FFE9E6] text-[#B8321F] tone [--tone:#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
          {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
          {it.sourceLabel}
        </span>
        <time dateTime={it.date} className="font-semibold text-sub">
          {dayLabel(it.date)}
        </time>
      </p>
      <h3 className="mt-2 text-[18px] font-black leading-snug tracking-[-0.02em]">{it.title}</h3>
      <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-sub">{it.short}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a href={it.url} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 text-[14px] font-extrabold text-sky-dark no-underline hover:underline">
          {video ? "영상 보기" : "원문 보기"}
          <IconExternal className="size-3.5" />
        </a>
        {it.coverage && <span className="text-[13px] font-bold text-sub">{it.coverage}</span>}
      </p>
    </li>
  );
}

/** 검색엔진용: 이 페이지(모음), 위치(맹고 > 관심 분야 > 분야), 소식 목록(원문 주소) */
function TopicJsonLd({ topic, items }: { topic: PublicTopic; items: PublicTopicItem[] }) {
  const url = appUrl(topicsPath(topic.slug));
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${topic.name} 소식`,
          url,
          description: description(topic),
          inLanguage: "ko-KR",
          isPartOf: { "@id": `${appUrl("/")}#website` },
          publisher: { "@id": organizationId() },
          about: { "@type": "Thing", name: topic.name },
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
            { "@type": "ListItem", position: 2, name: "관심 분야", item: appUrl(topicsPath()) },
            { "@type": "ListItem", position: 3, name: topic.name, item: url },
          ],
        },
      ]}
    />
  );
}
