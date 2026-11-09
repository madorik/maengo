import Script from "next/script";
import { NaverAnalytics } from "@/components/NaverAnalytics";
import { VercelWebAnalytics } from "@/components/VercelWebAnalytics";
import { GA4_MEASUREMENT_ID, INTERNAL_DEVICE_KEY, LIVE_HOSTS } from "@/lib/analytics";
import { BASE_PATH } from "@/lib/base-path";

// Google 태그 관리자(TODO.md 2번). 운영에서 NEXT_PUBLIC_GTM_ID(GTM-로 시작)가 있을 때만 싣는다. 이벤트는 lib/analytics.ts의 track()
const GTM_ID = /^GTM-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "") ? process.env.NEXT_PUBLIC_GTM_ID!.trim() : null;

/**
 * 내부 트래픽은 GA4에 보내지 않는다(2026-11-10, GA4 11-03~09에 localhost 추천 36세션·/admin 32세션이 섞여 있었다).
 * GA4 내부 트래픽 규칙은 IP 기준이라 집·회사·휴대폰마다 바뀌어서, 브라우저에서 GTM을 싣지 않는 쪽으로 막는다:
 * 운영 주소(watalabs.com)가 아닐 때(로컬·Vercel 미리보기), 관리자 화면, 내부 기기(내부 계정으로 로그인했거나 ?internal=1로 연 기기, ?internal=0이면 풀림)
 */
const gate = `var p=new URLSearchParams(location.search).get('internal');try{if(p==='1')localStorage.setItem('${INTERNAL_DEVICE_KEY}','1');if(p==='0')localStorage.removeItem('${INTERNAL_DEVICE_KEY}');}catch(e){}
var off=${JSON.stringify(LIVE_HOSTS)}.indexOf(location.hostname)<0||location.pathname.indexOf('${BASE_PATH}/admin')===0;try{off=off||localStorage.getItem('${INTERNAL_DEVICE_KEY}')==='1';}catch(e){}
if(off){window['ga-disable-${GA4_MEASUREMENT_ID}']=true;return;}`;

export function Analytics() {
  return (
    <>
      <VercelWebAnalytics />
      <NaverAnalytics />
      {GTM_ID && process.env.NODE_ENV === "production" ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(){${gate}(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');})();`}
        </Script>
      ) : null}
    </>
  );
}
