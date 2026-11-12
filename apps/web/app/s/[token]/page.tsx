import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronRight, IconExternal } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { PublicPage, StartBand } from "@/components/public/PublicPage";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { sharedItem } from "@/lib/server/shared-item";
import { decodeShareToken, sharePath } from "@/lib/server/share-token";
import { topicsPath } from "@/lib/public-topics";
import { SITE_NAME, appUrl } from "@/lib/site";

// 공유받은 소식(2026-10-23). 앱·웹의 '공유'가 이 주소를 보낸다(components/article/ShareButton.tsx, 주소는 actions.ts shareLinkFor).
// 1분 요약·분야·지난 소식 목록의 카드를 누르면 여는 1분 요약 전체 글도 이 화면이다(2026-11-10 사용자, components/public/TopicItem.tsx).
// 주소는 소식 번호가 아니라 암호화한 토큰(2026-11-08, lib/server/share-token.ts). 번호를 바꿔 다른 글을 보지 못하고, 옛 숫자 주소는 없는 페이지다.
// 로그인 없이 제목·한 줄 요약·전체 글(2026-11-08 사용자)·원문 링크가 보이고, 아래에 맹고 시작하기를 둔다. 검색에는 내지 않는다.
// 요약은 거의 바뀌지 않아서 하루마다 새로 그린다(처음 열 때 그리고 저장해 둔다).
export const revalidate = 86400;

type Props = { params: Promise<{ token: string }> };

/** 토큰이 맞으면 그 소식, 아니면 null */
async function load(params: Props["params"]) {
  const id = decodeShareToken((await params).token);
  return id ? sharedItem(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await load(params);
  if (!item) return { title: "소식", robots: { index: false, follow: true } };
  const url = appUrl(sharePath(item.clusterId));
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
  const item = await load(params);
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

        {/* 맹고가 다시 쓴 전체 글(글 화면과 같은 모양) */}
        {item.body.length > 0 && (
          <section aria-label="전체 글" className="mt-8 flex flex-col gap-4">
            {item.body.map((para, i) => (
              <p key={i} className="text-[17px] font-medium leading-[1.85]">
                {para}
              </p>
            ))}
          </section>
        )}

        <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-6 w-full gap-1.5 sm:w-auto sm:px-6">
          {sourceLink}
          <IconExternal className="size-4" />
          <span className="sr-only">(새 탭에서 열림)</span>
        </a>

        {/* 1분 요약 목록에서 카드를 눌러 들어온 사람도, 공유받은 사람도 다른 소식으로 이어 가게(2026-11-10) */}
        <p className="mt-8">
          <Link href={topicsPath()} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-extrabold text-sky-dark no-underline hover:underline">
            다른 소식도 1분 요약으로 보기
            <IconChevronRight className="size-4" />
          </Link>
        </p>
      </article>

      <StartBand title="내게 미칠 영향까지 받아 보세요" body="맹고가 관심 분야 소식을 골라 요약하고, 그 소식이 나한테 어떤 영향을 줄지 짚어 하루 두 번 보내 드려요. 음성으로도 들을 수 있어요." />
    </PublicPage>
  );
}
