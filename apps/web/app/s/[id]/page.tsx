import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconExternal } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { PublicPage, StartBand } from "@/components/public/PublicPage";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { sharedItem } from "@/lib/server/shared-item";
import { SITE_NAME, appUrl } from "@/lib/site";

// 공유받은 소식(2026-10-23). 앱·웹의 '공유'가 이 주소를 보낸다(components/article/ShareButton.tsx).
// 로그인 없이 제목·한 줄 요약·원문 링크만 보이고, 아래에 맹고 시작하기를 둔다. 같은 소식이 공개 분야 페이지에도 있어서 검색에는 내지 않는다.
// 요약은 거의 바뀌지 않아서 하루마다 새로 그린다(처음 열 때 그리고 저장해 둔다).
export const revalidate = 86400;

type Props = { params: Promise<{ id: string }> };

const sharedPath = (id: number) => `/s/${id}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await sharedItem(Number((await params).id));
  if (!item) return { title: "소식", robots: { index: false, follow: true } };
  const url = appUrl(sharedPath(item.clusterId));
  // 카드 이미지는 같은 폴더의 opengraph-image.tsx(제목을 넣어 그린다)가 붙인다
  return {
    title: item.title,
    description: item.short,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: { type: "article", locale: "ko_KR", siteName: SITE_NAME, title: item.title, description: item.short, url },
    twitter: { card: "summary_large_image", title: item.title, description: item.short },
  };
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

export default async function SharedItemPage({ params }: Props) {
  const item = await sharedItem(Number((await params).id));
  if (!item) notFound();
  const sourceLink = item.kind === "video" ? "유튜브에서 보기" : "원문 보기";

  return (
    <PublicPage>
      <article className="mx-auto max-w-[680px] px-5 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={item.category} />
          <span className="text-[14px] font-bold text-sub">
            {item.sourceLabel} · {dayLabel(item.date)}
          </span>
        </div>
        <h1 className="mt-3 text-[28px] font-black leading-[1.3] tracking-[-0.03em] md:text-[34px]">{item.title}</h1>

        {/* 상세 화면처럼 맹고가 말풍선으로 요약을 건넨다 */}
        <section aria-label="요약" className="mt-6 flex items-start gap-2">
          <Mascot className="size-14 shrink-0" />
          <Bubble className="flex-1">
            <p className="text-[17px] font-bold leading-[1.65]">{item.short}</p>
          </Bubble>
        </section>

        <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-6 w-full gap-1.5 sm:w-auto sm:px-6">
          {sourceLink}
          <IconExternal className="size-4" />
          <span className="sr-only">(새 탭에서 열림)</span>
        </a>
      </article>

      <StartBand title="관심 분야 소식을 매일 아침 받아 보세요" body="맹고가 고른 분야 소식만 요약해서 보내 드려요. 음성으로도 들을 수 있어요." />
    </PublicPage>
  );
}
