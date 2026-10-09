// 애플 로그인 client secret(JWT, ES256) 만들기. 애플은 최대 6개월만 허용하므로 만료 전에 다시 만든다(PLAN.md 5.1).
// 필요한 값(.env.local): APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_PRIVATE_KEY_PATH(.p8 파일 경로)
// 직접 실행: node --env-file=apps/web/.env.local scripts/apple-client-secret.mjs
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const MAX_DAYS = 180;

export function appleClientSecret({ teamId, keyId, servicesId, privateKeyPem, days = MAX_DAYS }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: teamId, iat: now, exp: now + days * 24 * 60 * 60, aud: 'https://appleid.apple.com', sub: servicesId };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // JWT ES256 서명은 DER가 아니라 r||s(64바이트) 형식이어야 한다
  const signature = sign('sha256', Buffer.from(input), { key: createPrivateKey(privateKeyPem), dsaEncoding: 'ieee-p1363' });
  return { token: `${input}.${b64url(signature)}`, expiresAt: new Date((now + days * 86400) * 1000) };
}

export function appleConfigFromEnv(env = process.env) {
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_PRIVATE_KEY_PATH } = env;
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_SERVICES_ID || !APPLE_PRIVATE_KEY_PATH) return null;
  return { teamId: APPLE_TEAM_ID, keyId: APPLE_KEY_ID, servicesId: APPLE_SERVICES_ID, privateKeyPem: readFileSync(APPLE_PRIVATE_KEY_PATH, 'utf8') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = appleConfigFromEnv();
  if (!cfg) {
    console.error('APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_PRIVATE_KEY_PATH를 .env.local에 넣어 주세요.');
    process.exit(1);
  }
  const { token, expiresAt } = appleClientSecret(cfg);
  console.log(token);
  console.error(`만료: ${expiresAt.toISOString().slice(0, 10)} — 그 전에 다시 만들어 Supabase에 넣어야 해요(pnpm setup:auth).`);
}
