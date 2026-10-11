import 'server-only';
import { demoToolsEnabled } from './demo';
import type { Profile } from './profile';

// 관리자(/admin) 확인. 운영은 환경 변수 ADMIN_EMAILS(쉼표로 여러 개)에 있는 로그인 이메일만.
// 로컬 개발(DEMO_TOOLS=1)에서는 데모 계정도 들어가 화면을 확인할 수 있다. 운영에는 DEMO_TOOLS를 넣지 않는다.
export function isAdmin(profile: Profile): boolean {
  if (demoToolsEnabled() && profile.demo) return true;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!profile.email && allowed.includes(profile.email.toLowerCase());
}
