import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// 맹고는 회사 도메인 watalabs.com의 /maengo 아래에서 돈다(packages/core/src/site.ts의 MAENGO_BASE_PATH와 같은 값).
// watalabs.com은 회사 사이트(apps/company) 프로젝트에 붙어 있고, /maengo/*를 이 프로젝트(maengo.vercel.app/maengo/*)로 넘긴다.
const BASE_PATH = "/maengo";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // packages/core·pipeline은 빌드 없이 TS 소스를 그대로 내보낸다(pipeline은 "오늘 맹고 받기"가 쓴다)
  transpilePackages: ["@maengo/core", "@maengo/pipeline"],
  // 유튜브 썸네일
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }] },
  // 서버 액션: 브라우저는 watalabs.com에서 보내고, 이 서버가 보는 호스트는 maengo.vercel.app이라 허용해 둔다
  experimental: { serverActions: { allowedOrigins: ["watalabs.com", "www.watalabs.com"] } },
  // 아이콘·manifest는 기본값(max-age=0)이면 화면을 옮길 때마다 서버에 다시 확인한다.
  // 아이콘 주소에는 내용 해시가 붙어(?icon.<hash>.svg) 바뀌면 주소도 바뀌므로 오래 둔다. manifest는 하루.
  // app/apple-icon.png는 app/icon.svg를 모서리 없이 180px로 그린 것(icon.svg를 바꾸면 같이 다시 만든다).
  // 코드로 그리는 apple-icon.tsx는 basePath가 안 붙은 주소(/apple-icon)로 나가서 파일로 둔다.
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/icon.svg", headers: immutable },
      { source: "/apple-icon.png", headers: immutable },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
  // 예전 주소(maengo.vercel.app/today 등). 이미 나간 1.1 앱은 maengo.vercel.app을 띄우므로 화면은 /maengo로 보낸다.
  // API·서비스 워커는 리다이렉트를 안 따르는 곳(cron·결제 웹훅)이 있어 vercel.json에서 /maengo로 이어 준다.
  async redirects() {
    return [
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      { source: "/:path((?!maengo|api/|_next/|push-sw\\.js).*)", destination: `${BASE_PATH}/:path`, basePath: false, permanent: false },
    ];
  },
};

// Sentry(오류 모니터링). 소스맵은 SENTRY_AUTH_TOKEN이 있을 때만 올린다(없으면 빌드만 하고 건너뛴다).
// CLI 배포는 git을 올리지 않아(.vercelignore) 릴리스 이름을 배포 id로 쓴다.
// 오류는 /maengo/monitoring(이 서버)을 거쳐 보낸다: 광고 차단기가 sentry.io로 가는 요청을 막아도 오류가 남게
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.VERCEL_DEPLOYMENT_ID },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  telemetry: false,
  silent: true,
});
