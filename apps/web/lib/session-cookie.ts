// proxy.ts(요청 앞단)와 서버 코드가 같이 쓴다. 서버 전용 모듈을 import하지 않는다.
// 지금은 데모 로그인이다. Supabase Auth가 붙으면 이 쿠키 대신 Supabase 세션 쿠키를 본다.
export const SESSION_COOKIE = 'maengo_session';
