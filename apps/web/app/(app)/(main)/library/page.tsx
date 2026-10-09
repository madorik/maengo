import { isCategory } from "@maengo/core/categories";
import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";
import { getLibrary } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "보관함" };

type Props = { searchParams: Promise<{ page?: string; category?: string }> };

export default async function LibraryPage({ searchParams }: Props) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const lib = await getLibrary(profile, {
    page: Number(sp.page) || 1,
    category: isCategory(sp.category) ? sp.category : null,
  });
  return <LibraryView lib={lib} />;
}
