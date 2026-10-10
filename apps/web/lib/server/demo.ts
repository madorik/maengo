import 'server-only';

// 개발용 데모 기능. 공개 배포(Vercel)에서는 꺼 둔다(누구나 공용 계정에 들어가거나 자기 플랜을 바꾸지 못하게).
/** 로그인 화면의 "데모 계정으로 둘러보기" → 공용 데모 계정. DEMO_USER_ID가 있을 때만(로컬 개발) */
export const demoLoginEnabled = () => !!process.env.DEMO_USER_ID?.trim();
/** 설정의 플랜 전환·피드 다시 고르기·처음 상태로. DEMO_TOOLS=1일 때만 */
export const demoToolsEnabled = () => process.env.DEMO_TOOLS === '1';
