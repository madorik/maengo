// 사이트 공통 정보(SEO). 제목·설명·주소를 한곳에서 관리한다.

export const SITE_NAME = "맹고";
export const SITE_TITLE = "맹고 - 관심 분야 기술 뉴스, 매일 아침 요약하고 읽어 드려요";
export const SITE_DESCRIPTION =
  "관심 있는 분야만 고르면 끝. 긱뉴스, 공식 블로그, 유튜브, 기술블로그를 AI가 매일 아침 훑어 그 분야 소식만 골라 요약하고, 왜 중요한지 짚어 주고, 오디오로 읽어 드려요.";
export const SITE_KEYWORDS = [
  "맹고",
  "기술 뉴스",
  "IT 뉴스 요약",
  "개발자 뉴스",
  "AI 뉴스",
  "개발 트렌드",
  "긱뉴스 요약",
  "기술 블로그 요약",
  "유튜브 요약",
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
