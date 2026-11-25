import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// 맹고는 회사 도메인 watalabs.com의 /maengo 아래에서 돈다(packages/core/src/site.ts의 MAENGO_BASE_PATH와 같은 값).
// watalabs.com은 회사 사이트(apps/company) 프로젝트에 붙어 있고, /maengo/*를 이 프로젝트(maengo.vercel.app/maengo/*)로 넘긴다.
const BASE_PATH = "/maengo";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // 개발 서버만: 안드로이드 에뮬레이터(호스트 = 10.0.2.2)에서 띄운 앱이 개발 서버의 스크립트를 받게(2026-11-11 알림 등록 확인). 운영 빌드엔 영향 없음
  allowedDevOrigins: ["10.0.2.2"],
  // packages/core·pipeline은 빌드 없이 TS 소스를 그대로 내보낸다(pipeline은 "오늘 맹고 받기"가 쓴다)
  transpilePackages: ["@maengo/core", "@maengo/pipeline"],
  // 공유한 소식의 카드 이미지(app/s/[id]/opengraph-image.tsx)는 요청 때 그려서 글꼴·아이콘 파일을 함수에 같이 넣어야 한다.
  // 글꼴은 assets/fonts에 복사해 둔 것을 쓴다(pnpm의 node_modules 링크는 배포된 함수 안에 없다, 2026-10-23 운영 ENOENT).
  // 맹고 기본 카드 이미지(app/opengraph-image.tsx)는 빌드 때 한 번 그려서 필요 없다
  outputFileTracingIncludes: {
    "/s/**": ["./assets/fonts/*.otf", "./app/icon.svg"],
  },
  // 유튜브 썸네일
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }] },
  // 서버 액션: 브라우저는 watalabs.com에서 보내고, 이 서버가 보는 호스트는 maengo.vercel.app이라 허용해 둔다
  experimental: {
    serverActions: { allowedOrigins: ["watalabs.com", "www.watalabs.com"] },
    // 로그인한 화면(오늘·보관함·설정)은 사람마다 달라 서버에서 그린다. 기본값(0초)이면 탭을 오갈 때마다 서버에 다시 받아 그동안 스켈레톤이 뜬다.
    // 30초 안에 돌아온 탭은 받아 둔 것을 그대로 보인다(2026-10-19). 읽음 표시는 TodayProvider가 클라이언트에서 겹쳐 보여 늦지 않고,
    // 소식 받기·플레이리스트·설정 저장은 revalidatePath·router.refresh로 바로 새로 받는다
    staleTimes: { dynamic: 30 },
  },
  // 아이콘·manifest는 기본값(max-age=0)이면 화면을 옮길 때마다 서버에 다시 확인한다.
  // 화면의 아이콘 링크에는 내용 해시가 붙어(?icon.<hash>.svg) 바뀌면 주소도 바뀐다. 다만 manifest·푸시 알림(push-sw.js)·재생 화면 그림은
  // 해시 없는 /icon.svg·/apple-icon.png를 쓰므로 1년 immutable이면 아이콘을 바꿔도(2026-11-25 소리 막대 망고) 받아 간 기기에 예전 그림이 남는다 → 하루. manifest도 하루.
  // app/apple-icon.png는 app/icon.svg를 모서리 없이 180px로 그린 것(icon.svg를 바꾸면 같이 다시 만든다).
  // 코드로 그리는 apple-icon.tsx는 basePath가 안 붙은 주소(/apple-icon)로 나가서 파일로 둔다.
  async headers() {
    const icon = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    // 공개 분야 화면(/topics…)은 누가 열어도 같다(로그인 버튼만 브라우저에서 바뀐다, components/public/PublicPage.tsx).
    // 주소의 ?page=·기간(searchParams) 때문에 요청마다 서버가 그려서 한 번에 CPU 0.5초쯤 들고(2026-11-21 Vercel 표본), 검색·SNS 로봇이 자주 읽는다.
    // Vercel CDN에만 10분 담아 둔다(Vercel-CDN-Cache-Control은 브라우저·다른 CDN에 가지 않고 Next의 Cache-Control보다 우선). 10분 안에 새 소식이 늦게 보일 수 있다.
    // 캐시 키에 배포 주소가 들어 있어 새 배포는 빈 캐시로 시작한다
    const publicCdn = [{ key: "Vercel-CDN-Cache-Control", value: "max-age=600, stale-while-revalidate=3600" }];
    return [
      { source: "/topics/:path*", headers: publicCdn },
      { source: "/icon.svg", headers: icon },
      { source: "/apple-icon.png", headers: icon },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
  // 예전 주소(maengo.vercel.app/today 등). 이미 나간 1.1 앱은 maengo.vercel.app을 띄우므로 화면은 /maengo로 보낸다.
  // API·서비스 워커는 리다이렉트를 안 따르는 곳(cron·결제 웹훅)이 있어 vercel.json에서 /maengo로 이어 준다.
  async redirects() {
    return [
      // 지난 소식 주소(2026-11-10에 한 시간 남짓 열었다가 같은 날 분야·주제 페이지의 목록 하나로 합침). 쪽·기간(?page=&from=&to=)은 그대로 넘어간다
      { source: "/topics/:slug/archive", destination: "/topics/:slug", permanent: true },
      { source: "/topics/:slug/:detail/archive", destination: "/topics/:slug/:detail", permanent: true },
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
