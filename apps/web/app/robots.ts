import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// 소개 페이지만 검색에 열고, 로그인해야 보이는 화면과 API는 막는다.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/today", "/article/", "/listen", "/library", "/settings"],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
