// 맹고가 붙는 주소. 회사 도메인(watalabs.com) 아래 /maengo 경로에서 돈다.
// 회사 사이트(apps/company)가 /maengo/*를 맹고 Vercel 프로젝트로 넘긴다(멀티존).

/** 맹고 웹의 경로. apps/web/next.config.ts의 basePath와 같아야 한다 */
export const MAENGO_BASE_PATH = '/maengo';

/** 회사 도메인. NEXT_PUBLIC_SITE_URL이 없을 때 쓴다 */
export const DEFAULT_SITE_ORIGIN = 'https://watalabs.com';

/**
 * 주간 리포트를 OpenAI(gpt-6-luna)로 만들기 시작하는 날(KST, 2026-11-25 사용자 결정 '주간 리포트도 루나로').
 * 개인정보 처리방침 2026-12-02 시행판(OpenAI에 맡기는 일에 주간 리포트를 더함, 7일 전 알림)과 같은 날이다(apps/web/lib/site.ts PRIVACY_EFFECTIVE_ON).
 * 그 전에는 지금처럼 Gemini로 만든다(pipeline/src/reports.ts)
 */
export const REPORT_OPENAI_FROM = '2026-12-02';

