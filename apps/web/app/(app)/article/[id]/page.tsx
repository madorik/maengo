import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article/ArticleView";
import { CLUSTER_BY_ID } from "@/lib/server/demo-clusters";
import { findFeedItem } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cluster = CLUSTER_BY_ID.get(Number((await params).id));
  return { title: cluster?.title ?? "소식" };
}

// 오늘 글이든 보관함의 지난 글이든, 이 사용자가 받은 적 있는 글만 연다
export default async function ArticlePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const found = await findFeedItem(await requireProfile(), id);
  if (!found) notFound();
  return <ArticleView key={id} item={found.item} isToday={found.isToday} />;
}
