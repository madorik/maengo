import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

// 공개 페이지 목록
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({ url: appUrl(path), lastModified: new Date(), changeFrequency: "monthly" as const, priority });
  return [
    { url: appUrl("/"), lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    page("/terms", 0.3),
    page("/privacy", 0.3),
    page("/delete-account", 0.2),
  ];
}
