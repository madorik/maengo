// 사이트 공통 정보(SEO). 제목·설명·주소를 한곳에서 관리한다.
import { DEFAULT_SITE_ORIGIN } from "@maengo/core/site";
import { withBase } from "./base-path";

// 화면 문구는 '소식'. 검색용(제목·키워드)에는 '뉴스 요약' 같은 검색어를 쓴다(2026-11-08 사용자 결정, 맹고-문서/검색-노출.md).
// 대상은 출퇴근하는 30~50대 직장인(2026-11-10 사용자 결정, 맹고-문서/타겟.md).
export const SITE_NAME = "맹고";
/** 영문 이름. 검색·AI가 '망고'와 헷갈리지 않게 구조화 데이터에 같이 적는다 */
export const SITE_NAME_EN = "Maengo";
export const SITE_TITLE = "맹고 - 출퇴근길에 귀로 듣는 관심 분야 뉴스 요약";
/** 맹고가 무엇인지 한 문장으로. 소개 첫 화면·자주 묻는 질문·llms.txt가 같은 말을 쓴다 */
export const SITE_DEFINITION = "맹고는 관심 분야의 소식을 AI로 요약해서 음성 지원해 주는 앱이에요.";
export const SITE_DESCRIPTION =
  "출퇴근길에 귀로 듣는 관심 분야 소식. 경제, 주식, AI, 코인, 반도체 같은 분야를 고르면 매일 아침 국내외 매체와 공식 블로그에서 그 분야 소식만 골라 출처와 함께 요약하고 읽어 드려요. 하루 소식을 다 들어도 약 15분이에요.";
export const SITE_KEYWORDS = [
  "맹고",
  "맹고 앱",
  "Maengo",
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
  "뉴스 요약",
  "AI 뉴스",
  "경제 뉴스 요약",
  "주식 뉴스 요약",
  "출근길 뉴스 듣기",
  "출퇴근 뉴스",
  "뉴스 읽어주는 앱",
];
/**
 * 공유 카드 이미지(app/opengraph-image.tsx). 페이지가 openGraph를 따로 주면 파일 이미지를 물려받지 못해서 직접 넣는다.
 * 주소는 메타데이터를 그릴 때 만든다(siteUrl()이 환경 변수를 읽는다)
 */
export function ogImages() {
  return [{ url: appUrl("/opengraph-image"), width: 1200, height: 630, alt: `${SITE_NAME} - 관심 분야의 소식을 AI로 요약해서 음성 지원해줘요` }];
}
/** 소개 페이지 문구를 바꾼 날. 사이트맵 lastmod로 나간다(빌드 시각을 쓰면 배포마다 모두 '바뀜'이 돼 검색엔진이 믿지 않는다) */
export const LANDING_UPDATED_ON = "2026-11-10";

/**
 * 다른 이름. 검색·AI가 과일 '망고'(Mango)나 비슷한 이름의 다른 서비스와 헷갈리지 않게 구조화 데이터에 같이 적는다
 * (2026-11-06 검색해 보니 '맹고'로 Mango AI·마고가 먼저 나왔다)
 */
export const SITE_ALT_NAMES = [SITE_NAME_EN, "맹고 앱", "Maengo app"];

// ---- 앱 스토어 ----
/** App Store 앱 id(iOS 1.3.0, 2026-11-06 한국 출시). 사파리 '앱 열기' 배너·구조화 데이터·소개 페이지 링크에 쓴다 */
export const APP_STORE_ID = "6821451147";
export const APP_STORE_URL = `https://apps.apple.com/kr/app/id${APP_STORE_ID}`;
/** Google Play 주소(Android 1.3.0, 2026-11-07 출시. 31개국). 바꾸면 apps/company(index.html JSON-LD·llms.txt)도 같이 고친다 */
export const PLAY_STORE_URL: string | null = "https://play.google.com/store/apps/details?id=kr.maengo.app";
/**
 * 스토어 리뷰 쓰기 주소(설정 > 앱 정보 '맹고 평가하기'). iOS 앱은 App Store 앱의 리뷰 쓰기 화면을 바로 연다(itms-apps는 웹뷰가 시스템으로 넘긴다).
 * 안드로이드 앱은 Play가 공개된 뒤에만. 웹은 App Store 리뷰 쓰기 페이지
 */
export function storeReviewUrl(platform: "ios" | "android" | null): string | null {
  // 안드로이드 앱은 Play 스토어 앱으로 연다(market:은 웹뷰가 시스템으로 넘긴다)
  if (platform === "android") return PLAY_STORE_URL ? "market://details?id=kr.maengo.app" : null;
  if (platform === "ios") return `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
}
/** 구조화 데이터 sameAs·운영체제 */
export const STORE_URLS = [APP_STORE_URL, PLAY_STORE_URL].filter((u): u is string => !!u);
export const APP_OPERATING_SYSTEMS = ["Web", "iOS", ...(PLAY_STORE_URL ? ["Android"] : [])].join(", ");

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
/** 약관·처리방침의 운영자(개인사업자 와타랩스, 2026-10-28 등록) */
export const OPERATOR_NAME = COMPANY_NAME;
/** 대표자이자 개인정보 보호책임자 */
export const CEO_NAME = "정민균";

/**
 * 사업자 정보(전자상거래법 표시 의무). 맹고 바닥·약관 페이지·설정 > 앱 정보·회사 사이트(apps/company/index.html) 바닥에 나온다.
 * 빈 값은 그 줄을 숨긴다. 통신판매업은 2026-11-02 서초구청 신고(신고증 발급), 번호가 있으면 공정위 사업자정보 확인 링크도 붙는다.
 * 회사 사이트는 정적 HTML이라 바꾸면 거기도 고친다.
 */
export const BUSINESS = {
  regNo: "422-17-02792",
  mailOrderNo: "제2026-서울서초-3688호",
  address: "서울특별시 서초구 방배로 141, 4층 415-47호(방배동, 텔콤빌딩 내방)",
  phone: "010-2809-7499",
};

/** 공정위 사업자정보 공개 페이지. 통신판매업 신고가 끝나야 내용이 나온다 */
export const businessCheckUrl = () => `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS.regNo.replaceAll("-", "")}`;
/** 문의·개인정보 요청 메일(문의 전용으로 새로 만든 주소). 문의하기 양식(/contact)도 이 주소로 보낸다. 비어 있으면 운영에서 약관·개인정보 처리방침 페이지를 숨긴다(404) */
export const SUPPORT_EMAIL = "watalabs.help@gmail.com";
/**
 * 이용약관·개인정보 처리방침 시행일. 2026-11-06 영업 시작에 맞춰 이 날로 하고 그 전 개정 이력은 지웠다(사용자 결정).
 * 이 뒤로 내용을 바꾸면 날짜도 바꾸고 약관 페이지 부칙 아래에 개정 이력을 다시 단다. 앱 안 팝업 공지는 하지 않는다(2026-10-18 사용자 결정)
 */
export const LEGAL_EFFECTIVE_ON = "2026-11-06";
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
