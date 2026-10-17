import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";
import { appUrl, siteUrl } from "@/lib/site";

// 소개 페이지만 검색에 열고, 로그인해야 보이는 화면과 API는 막는다.
// 이 파일은 /maengo/robots.txt로 나간다. 검색엔진이 읽는 도메인 루트의 robots.txt는 회사 사이트(apps/company)에 같은 규칙으로 있다.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: withBase("/"),
        disallow: ["/api/", "/login", "/today", "/article/", "/listen", "/library", "/settings", "/admin"].map(withBase),
      },
    ],
    sitemap: appUrl("/sitemap.xml"),
    host: base.origin,
  };
}
