// APNs 인증 키(.p8)가 개발(샌드박스)·운영 환경 중 어디에 붙는지 애플에 직접 물어본다. 가짜 기기 토큰으로 보내 알림은 아무에게도 가지 않는다.
//   pnpm apns:check [키 .p8 경로] [키 ID]
//   (안 주면 APNS_KEY_PATH·APNS_KEY_ID, 그것도 없으면 APPLE_PRIVATE_KEY_PATH·APPLE_KEY_ID. 팀·번들은 APPLE_TEAM_ID·APPLE_BUNDLE_ID)
// 인증되면 400 BadDeviceToken(키는 맞고 토큰만 가짜), 그 환경에 못 쓰는 키면 403(BadEnvironmentKeyInToken·InvalidProviderToken).
// 스토어·TestFlight 빌드는 운영 APNs로 간다. 운영이 403이면 FCM이 iOS로 THIRD_PARTY_AUTH_ERROR를 낸다(2026-11-27, 샌드박스 전용 키 XKH9RW6Y9W).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http2 from 'node:http2';
import { homedir } from 'node:os';

const [argPath, argId] = process.argv.slice(2);
const keyPath = (argPath ?? process.env.APNS_KEY_PATH ?? process.env.APPLE_PRIVATE_KEY_PATH ?? '').replace(/^~(?=\/)/, homedir());
const keyId = argId ?? process.env.APNS_KEY_ID ?? process.env.APPLE_KEY_ID ?? keyPath.match(/AuthKey_([A-Z0-9]{10})/)?.[1];
const teamId = process.env.APPLE_TEAM_ID;
const topic = process.env.APPLE_BUNDLE_ID ?? 'kr.maengo.app';
if (!keyPath || !keyId || !teamId) {
  console.error('키 경로·키 ID·APPLE_TEAM_ID가 필요해요: pnpm apns:check ~/.maengo/AuthKey_XXXXXXXXXX.p8');
  process.exit(2);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = `${b64({ alg: 'ES256', kid: keyId })}.${b64({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
const sig = sign('sha256', Buffer.from(unsigned), { key: createPrivateKey(readFileSync(keyPath)), dsaEncoding: 'ieee-p1363' }).toString('base64url');
const jwt = `${unsigned}.${sig}`;
const fakeToken = '0'.repeat(64);

function ask(host) {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on('error', (e) => resolve({ status: 0, reason: e.message }));
    const req = client.request({ ':method': 'POST', ':path': `/3/device/${fakeToken}`, authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10' });
    let status = 0;
    let body = '';
    req.on('response', (h) => (status = Number(h[':status'])));
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      client.close();
      let reason = body;
      try {
        reason = JSON.parse(body).reason ?? body;
      } catch {}
      resolve({ status, reason });
    });
    req.on('error', (e) => {
      client.close();
      resolve({ status: 0, reason: e.message });
    });
    req.end(JSON.stringify({ aps: { alert: 'apns-check' } }));
  });
}

let prodOk = false;
for (const [name, host] of [['개발(샌드박스)', 'api.sandbox.push.apple.com'], ['운영(Production)', 'api.push.apple.com']]) {
  const r = await ask(host);
  // 키가 맞으면 애플은 가짜 토큰을 BadDeviceToken으로 돌려준다(인증·토픽은 통과)
  const ok = r.status === 400 && r.reason === 'BadDeviceToken';
  if (host === 'api.push.apple.com') prodOk = ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${r.status} ${r.reason}`);
}
console.log(`키 ${keyId} · 팀 ${teamId} · 번들 ${topic}`);
if (!prodOk) {
  console.log('운영에 못 쓰는 키예요. 애플 개발자 > Keys에서 APNs 환경을 "Sandbox & Production"으로 고른 키를 새로 만들어 Firebase > 클라우드 메시징 > Apple 앱 구성의 프로덕션 칸에 올리세요.');
  process.exit(1);
}
