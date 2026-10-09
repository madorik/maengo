// Supabase 로그인 설정을 .env.local 값대로 맞춘다. 여러 번 돌려도 결과가 같다.
// - 돌아올 주소(redirect) 허용 목록, 사이트 주소, 이메일 가입 끄기(애플·구글만 쓴다)
// - GOOGLE_CLIENT_ID/SECRET이 있으면 구글 로그인을 켠다
// - APPLE_* 값이 있으면 client secret(6개월)을 새로 만들어 애플 로그인을 켠다
// 실행: pnpm setup:auth   (관리 토큰은 SUPABASE_ACCESS_TOKEN 또는 supabase CLI 로그인 정보)
import { execFileSync } from 'node:child_process';
import { appleClientSecret, appleConfigFromEnv } from './apple-client-secret.mjs';

const env = process.env;
const ref = env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error('SUPABASE_PROJECT_REF가 .env.local에 없어요.');

function managementToken() {
  if (env.SUPABASE_ACCESS_TOKEN) return env.SUPABASE_ACCESS_TOKEN;
  try {
    let t = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], { encoding: 'utf8' }).trim();
    if (t.startsWith('go-keyring-base64:')) t = Buffer.from(t.slice('go-keyring-base64:'.length), 'base64').toString('utf8');
    return t;
  } catch {
    throw new Error('Supabase 관리 토큰이 없어요. `supabase login` 하거나 SUPABASE_ACCESS_TOKEN을 넣어 주세요.');
  }
}

const site = (env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const redirects = [
  'http://localhost:3000/**',
  'http://localhost:3100/**',
  `${site}/**`,
  env.APP_URL_SCHEME ? `${env.APP_URL_SCHEME}://**` : null, // 앱(Capacitor)으로 돌아올 때
].filter(Boolean);

const body = {
  site_url: site,
  uri_allow_list: [...new Set(redirects)].join(','),
  external_email_enabled: false,
};
const enabled = [];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  // 앱에서 구글 로그인을 직접 띄우면 iOS·Android 클라이언트 ID도 받아야 해서 쉼표로 이어 붙인다
  const ids = [env.GOOGLE_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID].filter(Boolean);
  Object.assign(body, { external_google_enabled: true, external_google_client_id: ids.join(','), external_google_secret: env.GOOGLE_CLIENT_SECRET });
  enabled.push('구글');
}

const apple = appleConfigFromEnv(env);
if (apple) {
  const { token, expiresAt } = appleClientSecret(apple);
  const ids = [apple.servicesId, env.APPLE_BUNDLE_ID].filter(Boolean);
  Object.assign(body, { external_apple_enabled: true, external_apple_client_id: ids.join(','), external_apple_secret: token });
  enabled.push(`애플(시크릿 만료 ${expiresAt.toISOString().slice(0, 10)})`);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${managementToken()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`Supabase 설정 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);

console.log(`사이트 주소: ${site}`);
console.log(`돌아올 주소: ${body.uri_allow_list}`);
console.log('이메일 가입: 끔');
console.log(`켠 로그인: ${enabled.length ? enabled.join(', ') : '없음(구글·애플 값을 .env.local에 넣고 다시 돌려 주세요)'}`);
