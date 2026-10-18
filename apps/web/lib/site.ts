// 사이트 공통 정보(SEO). 제목·설명·주소를 한곳에서 관리한다.
import { DEFAULT_SITE_ORIGIN } from "@maengo/core/site";
import { withBase } from "./base-path";

export const SITE_NAME = "맹고";
export const SITE_TITLE = "맹고 - 관심 분야 소식, 매일 아침 요약하고 읽어 드려요";
export const SITE_DESCRIPTION =
  "관심 있는 분야만 고르면 끝. AI, 주식, 코인, 정치·경제 뉴스처럼 고른 분야의 국내외 매체와 공식 블로그를 AI가 매일 아침 훑어 그 분야 소식만 골라 요약하고, 오디오로 읽어 드려요.";
export const SITE_KEYWORDS = [
  "맹고",
  "뉴스 요약",
  "AI 뉴스",
  "주식 뉴스",
  "코인 뉴스",
  "반도체 뉴스",
  "헤드라인 뉴스 요약",
  "IT 뉴스 요약",
  "개발 트렌드",
  "오디오 브리핑",
  "출근길 팟캐스트",
];


// ---- 약관·개인정보 처리방침 ----
/** 운영자이자 개인정보 보호책임자. 사업자등록 전이라 개인 이름으로 적는다 */
export const OPERATOR_NAME = "정민균";
/** 문의·개인정보 요청 메일(문의 전용으로 새로 만든 주소). 비어 있으면 운영에서 약관·개인정보 처리방침 페이지를 숨긴다(404) */
export const SUPPORT_EMAIL = "watalabs.help@gmail.com";
/** 이용약관·개인정보 처리방침 시행일. 내용을 바꾸면 날짜도 바꾸고 변경 공지를 한다 */
export const LEGAL_EFFECTIVE_DATE = "2026년 10월 18일";
/** 약관이 바뀐 날(KST). 이 날 전에 가입한 회원에게 앱 안에서 한 번 알린다(결정 D4). 약관을 또 바꾸면 이 값과 위 날짜를 같이 바꾼다 */
export const LEGAL_CHANGED_ON = "2026-10-18";

/**
 * 문의 메일 링크(mailto): 제목과, 본문 아래에 문제를 찾는 데 쓸 정보(회원 번호 앞 8자리 등)를 미리 채운다.
 * 설정 > 문의하기와 구매 복원이 막혔을 때(다른 계정의 구매) 쓴다
 */
export function supportMailHref(subject: string, info: string[]): string {
  const body = ["", "", "", "---", "아래 정보는 문제를 찾는 데 써요.", ...info].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** 구매 복원·환불 문의 메일 제목(약관 6조: 환불·복원 요청은 문의하기로) */
export const BILLING_MAIL_SUBJECT = "[맹고 구매 복원·환불 문의]";

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
