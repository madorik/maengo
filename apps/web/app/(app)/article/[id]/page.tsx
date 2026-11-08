import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArticleView } from "@/components/article/ArticleView";
import { findFeedItem } from "@/lib/server/feed";
import { articleToken, decodeArticleToken } from "@/lib/server/share-token";
import { requireProfile } from "@/lib/server/session";

// 주소의 [id]는 소식 번호가 아니라 토큰(/article/<token>, 2026-11-08 사용자: 글 번호가 주소에 보이지 않게).
// 숫자 주소는 404. 다만 홈 화면 위젯(앱 1.3, 소식 번호로 연다)에서 온 것(?from=widget)만 그 사람이 받은 소식이면 토큰 주소로 넘긴다.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decodeArticleToken((await params).id);
  const found = id ? await findFeedItem(await requireProfile(), id) : null;
  return { title: found?.item.title ?? "소식" };
}

// 오늘 글이든 보관함의 지난 글이든, 이 사용자가 받은 적 있는 글만 연다
export default async function ArticlePage({ params, searchParams }: Props) {
  const raw = (await params).id;
  const profile = await requireProfile();
  const id = decodeArticleToken(raw);
  if (!id) {
    const { from } = await searchParams;
    if (from === "widget" && /^\d{1,12}$/.test(raw) && (await findFeedItem(profile, Number(raw)))) {
      redirect(`/article/${articleToken(Number(raw))}?from=widget`);
    }
    notFound();
  }
  const found = await findFeedItem(profile, id);
  if (!found) notFound();
  return <ArticleView key={id} item={found.item} isToday={found.isToday} />;
}
