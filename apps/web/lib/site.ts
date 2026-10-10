// 사이트 공통 정보(SEO). 제목·설명·주소를 한곳에서 관리한다.

export const SITE_NAME = "맹고";
export const SITE_TITLE = "맹고 - 관심 분야 소식, 매일 아침 요약하고 읽어 드려요";
export const SITE_DESCRIPTION =
  "관심 있는 분야만 고르면 끝. AI, 주식, 코인, K-Pop처럼 고른 분야의 국내외 매체와 공식 블로그를 AI가 매일 아침 훑어 그 분야 소식만 골라 요약하고, 오디오로 읽어 드려요.";
export const SITE_KEYWORDS = [
  "맹고",
  "뉴스 요약",
  "AI 뉴스",
  "주식 뉴스",
  "코인 뉴스",
  "반도체 뉴스",
  "K-Pop 뉴스",
  "IT 뉴스 요약",
  "개발 트렌드",
  "오디오 브리핑",
  "출근길 팟캐스트",
];

/** 정식 주소. NEXT_PUBLIC_SITE_URL을 먼저 쓰고, 없으면 Vercel 운영 주소, 그것도 없으면 로컬 */
export function siteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return new URL(fromEnv);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
