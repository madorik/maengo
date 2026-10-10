import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

// FCM HTTP v1로 푸시를 보낸다. 서비스 계정은 FIREBASE_SERVICE_ACCOUNT_JSON(운영, Vercel) 또는 FIREBASE_SERVICE_ACCOUNT_PATH(로컬 파일).

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let account: ServiceAccount | null | undefined;
function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  account = json ? (JSON.parse(json) as ServiceAccount) : path ? (JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount) : null;
  return account;
}

export const fcmReady = () => serviceAccount() !== null;

let cached: { token: string; until: number } | null = null;
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!body.access_token) throw new Error(`FCM 인증 실패: ${body.error ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export interface PushMessage {
  title: string;
  body: string;
  /** 알림을 누르면 열 앱 안 경로(예: /today?from=push) */
  path: string;
}

/** 'ok' 보냄, 'dead' 더는 없는 토큰(지운다), 'error' 그 밖의 실패 */
export type PushResult = 'ok' | 'dead' | 'error';

export async function sendPush(token: string, msg: PushMessage, siteUrl: string): Promise<PushResult> {
  const sa = serviceAccount();
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON(또는 _PATH)이 없어요');
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken(sa)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: { path: msg.path },
        webpush: { fcm_options: { link: new URL(msg.path, siteUrl).toString() } },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
  });
  if (res.ok) return 'ok';
  const err = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
  const code = err.error?.details?.find((d) => d.errorCode)?.errorCode ?? err.error?.status;
  return code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || res.status === 404 ? 'dead' : 'error';
}
