"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { withBase } from "@/lib/base-path";

// Vercel Web Analytics(2026-11-05). 쿠키 없이 화면 방문만 센다(Vercel 대시보드 > maengo > Analytics).
// Vercel은 Analytics를 켠 프로젝트의 빌드에 수집 주소를 넣어 준다(NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG,
// "d252bd7d36866536/view"처럼 사이트 루트 기준의 무작위 경로). 브라우저는 watalabs.com/maengo/*에서 돌아서 그대로 두면
// watalabs.com/<무작위>/view(회사 사이트 프로젝트)로 가 버려 안 쌓인다(2026-11-05 실제로 안 쌓임).
// 그래서 주소마다 /maengo를 붙이고, vercel.json이 /maengo/<무작위>/*·/maengo/_vercel/insights/*를 maengo.vercel.app 루트로 넘긴다
// (Vercel은 basePath 아래를 안 열어 준다). 설정 값은 빌드 때 브라우저 코드에 박히므로(NEXT_PUBLIC_) 클라이언트 컴포넌트에서 읽는다
const VERCEL_ANALYTICS = (() => {
  let conf: { scriptSrc?: string; viewEndpoint?: string; eventEndpoint?: string; sessionEndpoint?: string } = {};
  try {
    conf = JSON.parse(process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG ?? "{}").analytics ?? {};
  } catch {}
  const at = (p?: string) => (p ? withBase(`/${p.replace(/^\/+/, "")}`) : undefined);
  return {
    scriptSrc: at(conf.scriptSrc) ?? withBase("/_vercel/insights/script.js"),
    endpoint: withBase("/_vercel/insights"),
    viewEndpoint: at(conf.viewEndpoint),
    eventEndpoint: at(conf.eventEndpoint),
    sessionEndpoint: at(conf.sessionEndpoint),
  };
})();

export function VercelWebAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return <VercelAnalytics {...VERCEL_ANALYTICS} />;
}
