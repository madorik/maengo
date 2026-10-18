// Sentry(오류 모니터링) 공통 설정. 서버·엣지·브라우저가 같이 쓴다.
// DSN(NEXT_PUBLIC_SENTRY_DSN)이 없거나 운영 빌드가 아니면 아무것도 보내지 않는다.
// 성능 추적·세션 리플레이는 켜지 않는다(무료 플랜 한도·비용). 개인정보는 보내지 않고, 회원은 id로만 남긴다.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

export const sentryOptions = {
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  sendDefaultPii: false,
};
