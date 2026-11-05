import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import Script from "next/script";
import { withBase } from "@/lib/base-path";

// Google 태그 관리자(TODO.md 2번). 운영에서 NEXT_PUBLIC_GTM_ID(GTM-로 시작)가 있을 때만 싣는다. 이벤트는 lib/analytics.ts의 track()
const GTM_ID = /^GTM-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "") ? process.env.NEXT_PUBLIC_GTM_ID!.trim() : null;

export function Analytics() {
  return (
    <>
      <VercelWebAnalytics />
      {GTM_ID && process.env.NODE_ENV === "production" ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
    </>
  );
}

// Vercel Web Analytics(2026-11-05). 쿠키 없이 화면 방문만 센다(Vercel 대시보드 > maengo > Analytics).
// 브라우저는 watalabs.com/maengo/*에서 돌고, 기본 주소(/_vercel/insights)는 회사 사이트 프로젝트로 가 버린다.
// /maengo 아래로 적어 두면 회사 사이트의 /maengo/* 넘기기를 타고 이 프로젝트로 온다
function VercelWebAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return <VercelAnalytics scriptSrc={withBase("/_vercel/insights/script.js")} endpoint={withBase("/_vercel/insights")} />;
}
