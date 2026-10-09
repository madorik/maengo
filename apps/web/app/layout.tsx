import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";

// 한글은 Pretendard(글자 범위별로 필요한 조각만 받는다), 숫자는 둥근 Nunito.
const nunito = Nunito({
  weight: ["800", "900"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const verification: Metadata["verification"] = {
  google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  other: process.env.NAVER_SITE_VERIFICATION ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } : undefined,
};

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "technology",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  formatDetection: { telephone: false, email: false, address: false },
  verification,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
