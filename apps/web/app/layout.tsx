import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { NativeShell } from "@/components/NativeShell";
import { NavProgress } from "@/components/NavProgress";
import { ThemeSync } from "@/components/ThemeSync";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";
import { PAPER, THEME_SCRIPT } from "@/lib/theme";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAPER.light },
    { media: "(prefers-color-scheme: dark)", color: PAPER.dark },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme은 머리 스크립트가 그리기 전에 붙이므로 서버 HTML과 다를 수 있다
    <html lang="ko" className={nunito.variable} suppressHydrationWarning>
      <head>
        {/* 설정 > 화면에서 고른 테마를 첫 그림부터(lib/theme.ts) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <NavProgress />
        {children}
        <NativeShell />
        <ThemeSync />
        <Analytics />
      </body>
    </html>
  );
}
