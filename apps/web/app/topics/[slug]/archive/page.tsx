import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveView, archiveMetadata } from "@/components/public/ArchiveView";
import { kstToday, parseArchiveQuery } from "@/lib/public-archive";
import { publicTopicBySlug } from "@/lib/public-topics";
import { publicArchive } from "@/lib/server/public-topics";

// 분야의 지난 소식(/topics/<분야>/archive?page=&from=&to=, 2026-11-10). 쪽·기간이 주소에 있어 요청마다 그리고,
// 읽은 결과는 publicArchive가 한 시간 동안 들고 있다. 없는 분야·마지막 쪽 너머는 404
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load({ params, searchParams }: Props) {
  const topic = publicTopicBySlug((await params).slug);
  if (!topic) notFound();
  const query = parseArchiveQuery(await searchParams);
  const archive = await publicArchive(topic, query);
  if (query.page > 1 && archive.items.length === 0) notFound();
  return { topic, query, archive };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { topic, query, archive } = await load(props);
  return archiveMetadata(topic, query, archive.total);
}

export default async function TopicArchivePage(props: Props) {
  const { topic, query, archive } = await load(props);
  return <ArchiveView topic={topic} archive={archive} query={query} today={kstToday()} />;
}
