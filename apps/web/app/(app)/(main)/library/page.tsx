import { isCategory } from "@maengo/core/categories";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { LibraryView } from "@/components/library/LibraryView";
import { isAppUserAgent } from "@/lib/app-client";
import { parseLibraryQuery } from "@/lib/library-search";
import { getLibrary } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "보관함" };

type Props = { searchParams: Promise<{ page?: string; category?: string; read?: string; q?: string }> };

export default async function LibraryPage({ searchParams }: Props) {
  const profile = await requireProfile();
  const sp = await searchParams;
  // 앱(User-Agent에 MaengoApp/)은 이어 붙이기라 늘 1쪽부터 그린다. 서버에서 정해야 첫 그림(하이드레이션)이 서버 HTML과 같다
  const infinite = isAppUserAgent((await headers()).get("user-agent"));
  const lib = await getLibrary(profile, {
    page: infinite ? 1 : Number(sp.page) || 1,
    category: isCategory(sp.category) ? sp.category : null,
    read: sp.read === "unread" ? "unread" : null,
    query: parseLibraryQuery(sp.q),
  });
  return <LibraryView lib={lib} infinite={infinite} />;
}
