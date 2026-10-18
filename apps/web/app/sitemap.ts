import type { MetadataRoute } from "next";
import { PUBLIC_TOPICS, topicsPath } from "@/lib/public-topics";
import { publicTopicsUpdatedAt } from "@/lib/server/public-topics";
import { LANDING_UPDATED_ON, LEGAL_EFFECTIVE_ON, appUrl } from "@/lib/site";

// 공개 페이지 목록. lastmod는 내용이 실제로 바뀐 날만 쓴다(빌드 시각을 쓰면 배포마다 모두 '바뀜'이 돼 검색엔진이 믿지 않는다).
// 분야 페이지는 마지막으로 요약된 소식의 시각이라 한 시간마다 다시 만든다.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const updated = await publicTopicsUpdatedAt();
  const latest = [...updated.values()].sort().at(-1);
  const legal = (path: string, priority: number) => ({ url: appUrl(path), lastModified: LEGAL_EFFECTIVE_ON, changeFrequency: "yearly" as const, priority });
  return [
    { url: appUrl("/"), lastModified: LANDING_UPDATED_ON, changeFrequency: "weekly", priority: 1 },
    { url: appUrl(topicsPath()), lastModified: latest ?? LANDING_UPDATED_ON, changeFrequency: "daily", priority: 0.8 },
    ...PUBLIC_TOPICS.map((t) => ({ url: appUrl(topicsPath(t.slug)), lastModified: updated.get(t.slug) ?? LANDING_UPDATED_ON, changeFrequency: "daily" as const, priority: 0.7 })),
    legal("/terms", 0.3),
    legal("/privacy", 0.3),
    legal("/delete-account", 0.2),
  ];
}
