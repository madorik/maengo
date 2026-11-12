import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemListLd, listMetadata, NewsList } from "@/components/public/NewsList";
import { JsonLd, PublicPage, StartBand } from "@/components/public/PublicPage";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { kstToday, parseArchiveQuery, type ArchiveQuery } from "@/lib/public-archive";
import { detailsLine, PUBLIC_TOPICS, publicTopicBySlug, topicsPath, type PublicTopic } from "@/lib/public-topics";
import { getPlans } from "@/lib/server/plans";
import { publicArchive, publicTopicDigest, type PublicArchive } from "@/lib/server/public-topics";
import { SITE_NAME, appUrl, organizationId } from "@/lib/site";

// 공개 분야 페이지. 이 분야(세부 주제까지) 소식 전부를 최신순 목록 하나로(2026-11-10 사용자 '이번주, 지난 주 구분하지말고 전체 리스트 하나로',
// components/public/NewsList.tsx), 출처, 묻고 답하기. 쪽·기간이 주소(?page=&from=&to=)에 있어 요청마다 그리고, 목록·출처는 public-topics.ts가 한 시간 들고 있다.
// 없는 분야는 아래 notFound()가 404로 답한다. dynamicParams = false로 막으면 basePath 밖 주소를 /maengo로 넘기는
// next.config.ts의 리다이렉트와 엮여 같은 주소로 끝없이 307을 낸다(2026-10-18 확인)
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const title = (t: PublicTopic) => `${t.name} 소식 요약, 출퇴근길에 듣기`;
const description = (t: PublicTopic) =>
  `${t.name} 분야(${detailsLine(t, 4)}) 소식을 AI로 요약해서 출근길·퇴근길에 음성으로 들려줘요. 맹고가 요약한 ${t.name} 소식을 최신순으로 모두 모았어요.`;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const topic = publicTopicBySlug((await params).slug);
  if (!topic) return {};
  return listMetadata(topic, { title: title(topic), description: description(topic) }, parseArchiveQuery(await searchParams));
}

/**
 * 분야마다 묻고 답하기(2026-11-06, AI 답변·검색이 그대로 옮겨 가기 좋게 첫 문장에 결론). 출처·세부 관심사·플랜 값이 분야마다 달라
 * 같은 문장을 다섯 페이지에 찍어 내지 않는다. 화면과 구조화 데이터(FAQPage)가 같은 글을 쓴다
 */
function topicFaq(t: PublicTopic, sources: string[], free: { dailyItems: number; dailyListens: number }, plusItems: number): [string, string][] {
  return [
    [
      `맹고의 ${t.name} 분야는 어떤 소식을 다뤄요?`,
      t.details.length
        ? `${detailsLine(t)} 소식을 다뤄요. 따로 고르지 않아도 읽고 듣는 소식에 맞춰 맹고가 이 분야 소식을 더 받거나 덜 받게 맞춰요.`
        : `${t.name} 분야의 새 소식을 다뤄요.`,
    ],
    [
      `${t.name} 소식은 어디서 모아요?`,
      `${sources.length ? `${sources.slice(0, 6).join(", ")} 같은 ` : ""}국내외 매체와 공식 블로그에서 모아요. 영어로 나온 소식도 한국어로 요약하고, 모든 소식에 원문 링크가 있어 바로 확인할 수 있어요.`,
    ],
    [
      `${t.name} 소식은 언제, 몇 개 받아요?`,
      `출근길·퇴근길 하루 두 번, 정한 시각에 브리핑을 보내 드려요. 브리핑마다 ${plusItems > free.dailyItems ? `Free ${free.dailyItems}개, Premium ${plusItems}개` : `소식 ${free.dailyItems}개`}이고, 여러 곳에서 다룬 같은 소식은 하나로 묶어 이슈도가 높은 소식부터 골라요.`,
    ],
    [
      `${t.name} 소식을 음성으로 들을 수 있나요?`,
      `네. Premium이면 ${t.name} 소식을 플레이리스트에 담아 끝까지 이어서 들을 수 있어요.${free.dailyListens > 0 ? ` Free도 하루 ${free.dailyListens}개는 들을 수 있어요.` : ""}`,
    ],
  ];
}

export default async function TopicPage({ params, searchParams }: Props) {
  const topic = publicTopicBySlug((await params).slug);
  if (!topic) notFound();
  const query = parseArchiveQuery(await searchParams);
  const [{ sources }, plans, archive] = await Promise.all([publicTopicDigest(topic), getPlans(), publicArchive(topic, query)]);
  if (query.page > 1 && archive.items.length === 0) notFound();
  const others = PUBLIC_TOPICS.filter((t) => t.slug !== topic.slug);
  const faq = topicFaq(topic, sources, plans.get("free")!, plans.get("plus")!.dailyItems);

  return (
    <PublicPage>
      <TopicJsonLd topic={topic} archive={archive} query={query} faq={faq} />
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
            <li aria-current="page" className="text-ink">
              {topic.name}
            </li>
          </ol>
        </nav>

        <header className="mt-8">
          <TopicGroupIcon id={topic.id} className="size-14 rounded-2xl" iconClassName="size-8" />
          <h1 className="mt-4 text-[34px] font-black leading-[1.2] tracking-[-0.04em] md:text-[44px]">{topic.name} 소식</h1>
          <p className="mt-4 text-[17px] font-medium leading-relaxed text-sub">
            맹고의 {topic.name} 분야는 {detailsLine(topic)} 소식을 다뤄요. 아침과 오후에 국내외 매체와 공식 블로그에서 새 글을 모아 같은 소식은 하나로 묶고, AI로 요약해서
            출근길·퇴근길에 음성으로 들려줘요.
          </p>
        </header>

        {/* 소식 목록. 위 칩으로 세부 주제 페이지(/topics/<분야>/<주제>)로 좁힌다 */}
        <div className="mt-10">
          <NewsList scope={topic} archive={archive} query={query} today={kstToday()} />
        </div>

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

        <section aria-labelledby="faq-title" className="mt-14">
          <h2 id="faq-title" className="text-[24px] font-black tracking-[-0.03em] md:text-[28px]">
            {topic.name} 소식, 자주 묻는 질문
          </h2>
          <div className="mt-5 flex flex-col gap-3">
            {faq.map(([q, a]) => (
              <details key={q} className="tile group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-black">
                  {q}
                  <span aria-hidden="true" className="text-[22px] font-black text-sky transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] font-medium leading-relaxed text-sub">{a}</p>
              </details>
            ))}
          </div>
        </section>

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

      <StartBand title={`${topic.name} 소식을 출퇴근길에 받아 보세요`} body="끌리는 소식 몇 개만 누르면 맹고가 내 관심에 맞는 소식을 골라 드려요. 음성으로도 들어요." />
    </PublicPage>
  );
}

/** 검색엔진용: 이 페이지(모음), 위치(맹고 > 1분 요약 > 분야), 이 쪽의 소식 목록(원문 주소), 자주 묻는 질문 */
function TopicJsonLd({ topic, archive, query, faq }: { topic: PublicTopic; archive: PublicArchive; query: ArchiveQuery; faq: [string, string][] }) {
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
          mainEntity: itemListLd(archive, query),
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: appUrl("/") },
            { "@type": "ListItem", position: 2, name: "1분 요약", item: appUrl(topicsPath()) },
            { "@type": "ListItem", position: 3, name: topic.name, item: url },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${url}#faq`,
          mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        },
      ]}
    />
  );
}
