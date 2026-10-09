import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// 공개 페이지 목록. 이용약관·개인정보 처리방침이 생기면 여기에 더한다.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/", siteUrl()).toString(), lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
