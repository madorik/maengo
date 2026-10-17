// 맹고가 붙는 주소. 회사 도메인(watalabs.com) 아래 /maengo 경로에서 돈다.
// 회사 사이트(apps/company)가 /maengo/*를 맹고 Vercel 프로젝트로 넘긴다(멀티존).

/** 맹고 웹의 경로. apps/web/next.config.ts의 basePath와 같아야 한다 */
export const MAENGO_BASE_PATH = '/maengo';

/** 회사 도메인. NEXT_PUBLIC_SITE_URL이 없을 때 쓴다 */
export const DEFAULT_SITE_ORIGIN = 'https://watalabs.com';
