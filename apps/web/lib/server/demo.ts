import 'server-only';

// 개발용 데모 기능. 공개 배포(Vercel)에서는 꺼 둔다(누구나 공용 계정에 들어가거나 자기 플랜을 바꾸지 못하게).
// 운영(VERCEL_ENV=production)에서는 환경 변수와 상관없이 늘 꺼진다(2026-10-18 점검: DEMO_USER_ID·DEMO_TOOLS를 실수로 넣어도 열리지 않게).
// 미리보기 배포(preview)와 로컬은 환경 변수대로.
/** 운영 배포인지 */
export const isProductionDeploy = () => process.env.VERCEL_ENV === 'production';
/** 로그인 화면의 "데모 계정으로 둘러보기" → 공용 데모 계정. DEMO_USER_ID가 있을 때만(로컬 개발) */
export const demoLoginEnabled = () => !isProductionDeploy() && !!process.env.DEMO_USER_ID?.trim();
/** 데모 세션 쿠키(서명한 maengo_session)를 로그인으로 볼지. 운영에서는 읽지 않는다 */
export const demoSessionEnabled = () => !isProductionDeploy();
/** 설정의 플랜 전환·피드 다시 고르기·처음 상태로. DEMO_TOOLS=1일 때만 */
export const demoToolsEnabled = () => !isProductionDeploy() && process.env.DEMO_TOOLS === '1';
/** 공용 데모 계정인지(지우면 안 된다). 운영에는 DEMO_USER_ID가 없어 늘 false */
export const isDemoAccount = (userId: string) => userId === process.env.DEMO_USER_ID?.trim();
