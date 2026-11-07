// proxy.ts(요청 앞단)와 서버 코드가 같이 쓴다. 서버 전용 모듈을 import하지 않는다.
// 구글 로그인은 Supabase 세션 쿠키(sb-…)를 쓰고, 아래 쿠키는 애플 연동 전까지 쓰는 데모 로그인용이다.
export const SESSION_COOKIE = 'maengo_session';
/** 로그인했는지만 알려 주는 쿠키(비밀 아님, JS에서 읽음). 정적 소개 페이지가 버튼 문구를 바꾸는 데 쓴다 */
export const SIGNED_IN_HINT = 'maengo_signed_in';
/**
 * 로그인 뒤 갈 곳(비밀 아님, JS가 쓴다). 둘러보기(/try) 끝의 'Premium 무료 체험하기'가 'trial'로 남기면
 * 로그인(이미 가입한 사람)이나 관심사 고르기(처음 온 사람)를 마친 뒤 요금제(/premium?trial=1)로 가 체험 안내를 띄우고 지운다
 */
export const AFTER_LOGIN_COOKIE = 'maengo_after_login';
