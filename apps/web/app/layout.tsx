import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 한글은 Pretendard(글자 범위별로 필요한 조각만 받는다), 숫자는 둥근 Nunito.
const nunito = Nunito({
  weight: ["800", "900"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "맹고", template: "%s | 맹고" },
  description: "직업과 관심사에 맞춘 기술 소식을 매일 아침 골라 읽고 들어요.",
  applicationName: "맹고",
  appleWebApp: { capable: true, title: "맹고", statusBarStyle: "default" },
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
