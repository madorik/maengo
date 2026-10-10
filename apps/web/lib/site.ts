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

// ---- 약관·개인정보 처리방침 ----
/** 운영자이자 개인정보 보호책임자. 사업자등록 전이라 개인 이름으로 적는다 */
export const OPERATOR_NAME = "정민균";
/** 문의·개인정보 요청 메일(문의 전용으로 새로 만든 주소). 비어 있으면 운영에서 약관·개인정보 처리방침 페이지를 숨긴다(404) */
export const SUPPORT_EMAIL = "";
/** 이용약관·개인정보 처리방침 시행일. 내용을 바꾸면 날짜도 바꾸고 변경 공지를 한다 */
export const LEGAL_EFFECTIVE_DATE = "2026년 10월 10일";

/**
 * 문의 메일. 빈 메일로 문서를 공개하지 않도록 운영에서는 비어 있으면 null(문서 페이지가 404로 숨는다).
 * 빌드는 막지 않는다(다른 작업의 배포까지 멈추지 않게). 로컬에서는 자리만 보여 준다.
 */
export function supportEmail(): string | null {
  if (SUPPORT_EMAIL) return SUPPORT_EMAIL;
  return process.env.NODE_ENV === "production" ? null : "문의 메일(준비 중)";
}

/** 정식 주소. NEXT_PUBLIC_SITE_URL을 먼저 쓰고, 없으면 Vercel 운영 주소, 그것도 없으면 로컬 */
export function siteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return new URL(fromEnv);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
