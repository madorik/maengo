import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveView, archiveMetadata } from "@/components/public/ArchiveView";
import { kstToday, parseArchiveQuery } from "@/lib/public-archive";
import { publicDetailBySlug } from "@/lib/public-topics";
import { publicArchive } from "@/lib/server/public-topics";

// 세부 주제의 지난 소식(/topics/<분야>/<주제>/archive?page=&from=&to=, 2026-11-10). 분야의 지난 소식과 같은 화면
type Props = { params: Promise<{ slug: string; detail: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load({ params, searchParams }: Props) {
  const { slug, detail } = await params;
  const d = publicDetailBySlug(slug, detail);
  if (!d) notFound();
  const query = parseArchiveQuery(await searchParams);
  const archive = await publicArchive(d, query);
  if (query.page > 1 && archive.items.length === 0) notFound();
  return { d, query, archive };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { d, query, archive } = await load(props);
  return archiveMetadata(d, query, archive.total);
}

export default async function DetailArchivePage(props: Props) {
  const { d, query, archive } = await load(props);
  return <ArchiveView topic={d} archive={archive} query={query} today={kstToday()} />;
}
