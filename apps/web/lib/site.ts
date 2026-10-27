// 사이트 공통 정보(SEO). 제목·설명·주소를 한곳에서 관리한다.
import { DEFAULT_SITE_ORIGIN } from "@maengo/core/site";
import { withBase } from "./base-path";

// 검색 노출 문구에도 '뉴스 요약'을 쓰지 않는다. 한 건은 '소식'이다(2026-10-18 사용자 결정).
export const SITE_NAME = "맹고";
/** 영문 이름. 검색·AI가 '망고'와 헷갈리지 않게 구조화 데이터에 같이 적는다 */
export const SITE_NAME_EN = "Maengo";
export const SITE_TITLE = "맹고 - 관심 분야의 소식을 AI로 요약해서 음성 지원해줘요";
/** 맹고가 무엇인지 한 문장으로. 소개 첫 화면·자주 묻는 질문·llms.txt가 같은 말을 쓴다 */
export const SITE_DEFINITION = "맹고는 관심 분야의 소식을 AI로 요약해서 음성 지원해 주는 앱이에요.";
export const SITE_DESCRIPTION =
  "관심 분야의 소식을 AI로 요약해서 음성 지원해줘요. AI, 주식, 코인, 반도체·로봇, Tech, 정치·경제 같은 분야를 고르면 매일 아침 국내외 매체와 공식 블로그에서 그 분야 소식만 골라 출처와 함께 요약하고 읽어 드려요.";
export const SITE_KEYWORDS = [
  "맹고",
  "관심 분야 소식",
  "AI 소식",
  "주식 소식",
  "코인 소식",
  "반도체 소식",
  "Tech 소식",
  "소식 요약",
  "AI 요약",
  "음성 지원",
  "오디오 브리핑",
  "출근길 듣기",
];
/**
 * 공유 카드 이미지(app/opengraph-image.tsx). 페이지가 openGraph를 따로 주면 파일 이미지를 물려받지 못해서 직접 넣는다.
 * 주소는 메타데이터를 그릴 때 만든다(siteUrl()이 환경 변수를 읽는다)
 */
export function ogImages() {
  return [{ url: appUrl("/opengraph-image"), width: 1200, height: 630, alt: `${SITE_NAME} - 관심 분야의 소식을 AI로 요약해서 음성 지원해줘요` }];
}
/** 소개 페이지 문구를 바꾼 날. 사이트맵 lastmod로 나간다(빌드 시각을 쓰면 배포마다 모두 '바뀜'이 돼 검색엔진이 믿지 않는다) */
export const LANDING_UPDATED_ON = "2026-10-27";

// ---- 운영사(와타랩스) ----
export const COMPANY_NAME = "와타랩스";
export const COMPANY_NAME_EN = "WataLabs";

/** 회사 사이트 주소(https://watalabs.com/) */
export function companyUrl(): string {
  return new URL("/", siteUrl()).toString();
}

/** 구조화 데이터에서 운영사를 가리키는 id. 회사 사이트(apps/company/index.html)의 Organization과 같은 값이다 */
export function organizationId(): string {
  return `${companyUrl()}#organization`;
}

/** 운영사 구조화 데이터(schema.org Organization). 회사 사이트에 같은 내용이 있고, 맹고 페이지는 @id로 잇는다 */
export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: COMPANY_NAME,
    alternateName: COMPANY_NAME_EN,
    url: companyUrl(),
    logo: new URL("/apple-touch-icon.png", siteUrl()).toString(),
    email: SUPPORT_EMAIL,
  };
}


// ---- 약관·개인정보 처리방침 ----
/** 운영자이자 개인정보 보호책임자. 사업자등록 전이라 개인 이름으로 적는다 */
export const OPERATOR_NAME = "정민균";
/** 문의·개인정보 요청 메일(문의 전용으로 새로 만든 주소). 문의하기 양식(/contact)도 이 주소로 보낸다. 비어 있으면 운영에서 약관·개인정보 처리방침 페이지를 숨긴다(404) */
export const SUPPORT_EMAIL = "watalabs.help@gmail.com";
/**
 * 이용약관·개인정보 처리방침 시행일. 내용을 바꾸면 날짜도 바꾸고 약관 페이지 아래 개정 이력에 한 줄 더한다.
 * 앱 안 팝업 공지는 하지 않는다(2026-10-18 사용자 결정)
 */
export const LEGAL_EFFECTIVE_ON = "2026-10-26";
export const LEGAL_EFFECTIVE_DATE = (() => {
  const [y, m, d] = LEGAL_EFFECTIVE_ON.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
})();

/**
 * 문의 메일. 빈 메일로 문서를 공개하지 않도록 운영에서는 비어 있으면 null(문서 페이지가 404로 숨는다).
 * 빌드는 막지 않는다(다른 작업의 배포까지 멈추지 않게). 로컬에서는 자리만 보여 준다.
 */
export function supportEmail(): string | null {
  if (SUPPORT_EMAIL) return SUPPORT_EMAIL;
  return process.env.NODE_ENV === "production" ? null : "문의 메일(준비 중)";
}

/**
 * 정식 도메인(경로 없이). NEXT_PUBLIC_SITE_URL을 먼저 쓰고, 없으면 Vercel 빌드(운영·미리 보기)는 회사 도메인, 그 밖은 로컬.
 * 맹고 화면 주소는 이 도메인 아래 /maengo라 appUrl()로 만든다. Next는 canonical·OG 주소에 basePath를 안 붙여서
 * metadataBase도 appUrl("/")로 준다(app/layout.tsx).
 */
export function siteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return new URL(new URL(fromEnv).origin);
  if (process.env.VERCEL) return new URL(DEFAULT_SITE_ORIGIN);
  return new URL("http://localhost:3000");
}

/** 맹고 화면의 전체 주소. appUrl("/privacy") → https://watalabs.com/maengo/privacy */
export function appUrl(path = "/"): string {
  return new URL(withBase(path), siteUrl()).toString();
}
