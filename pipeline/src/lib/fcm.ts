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

/**
 * FCM·구글 인증 요청 하나를 기다리는 최대 시간. 넘으면 끊고 던진다(pushToUser가 잠깐의 실패 'retry'로 본다).
 * 제한이 없으면 응답이 멈췄을 때 300초 함수가 통째로 끊겨 가져간 줄이 남았다(2026-10-18 점검)
 */
export const FCM_TIMEOUT_MS = 10_000;

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
    signal: AbortSignal.timeout(FCM_TIMEOUT_MS),
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

/** 'ok' 보냄, 'dead' 더는 없는 토큰(지운다), 'retry' 잠깐의 실패(잠시 뒤 다시), 'error' 그 밖의 실패(다시 해도 같다, 토큰은 둔다) */
export type PushResult = 'ok' | 'dead' | 'retry' | 'error';

/** 기기 하나에 보낸 결과. 실패면 FCM 오류 코드(없으면 HTTP 상태)를 같이 줘서 배송 기록(last_error)에 남긴다 */
export interface PushOutcome {
  result: PushResult;
  code?: string;
}

interface FcmErrorBody {
  error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
}

/** FCM 오류 코드: details의 errorCode(예: THIRD_PARTY_AUTH_ERROR), 없으면 error.status, 그것도 없으면 HTTP 상태 */
export function fcmErrorCode(status: number, body: FcmErrorBody | null): string {
  return body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status ?? `HTTP ${status}`;
}

/**
 * FCM 실패 응답을 나눈다(https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode).
 * 토큰을 지우는 건 그 토큰 문제일 때만: UNREGISTERED(404), SENDER_ID_MISMATCH, 토큰이 틀렸다는 INVALID_ARGUMENT.
 * INVALID_ARGUMENT는 메시지 모양이 틀려도 오므로 오류 문구가 토큰을 가리킬 때만 지운다(전엔 다 지워서 멀쩡한 기기가 빠질 수 있었다).
 * THIRD_PARTY_AUTH_ERROR(401)는 Firebase에 올린 APNs 인증 키·웹 푸시 키가 없거나 틀렸다는 뜻이라 다시 보내도 같다: 'error'(토큰은 둔다).
 * 전엔 401이라 잠깐의 실패로 다시 보내다 '기기 없음'으로 접혀, 스토어 빌드 iOS 알림이 앱 공개 뒤 3주 동안 하나도 안 간 게 가려졌다(2026-11-26).
 * 그 밖의 429·5xx·인증(401) 실패는 잠깐의 실패로 본다
 */
export function classifyFcmError(status: number, body: FcmErrorBody | null): Exclude<PushResult, 'ok'> {
  const code = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status;
  if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH' || status === 404) return 'dead';
  if (code === 'INVALID_ARGUMENT' || status === 400) return /registration token/i.test(body?.error?.message ?? '') ? 'dead' : 'error';
  if (code === 'THIRD_PARTY_AUTH_ERROR') return 'error';
  if (status === 429 || status === 401 || status >= 500 || code === 'QUOTA_EXCEEDED' || code === 'UNAVAILABLE' || code === 'INTERNAL') return 'retry';
  return 'error';
}

/** 실패한 기기들의 FCM 오류 코드를 겹치지 않게 모은다(예: 'THIRD_PARTY_AUTH_ERROR, UNAVAILABLE') */
export function failureCodes(results: PushOutcome[], kind: PushResult): string {
  return [...new Set(results.filter((r) => r.result === kind && r.code).map((r) => r.code))].join(', ');
}

/** 다시 해도 같은 실패의 기록 문구. APNs 인증 오류면 고칠 곳을 같이 적는다 */
export function errorNote(codes: string): string {
  const hint = codes.includes('THIRD_PARTY_AUTH_ERROR') ? ' — Firebase 클라우드 메시징에 APNs 인증 키(.p8)가 있는지 보세요' : '';
  return `FCM 발송 실패(${codes || '코드 없음'})${hint}`;
}

export async function sendPush(token: string, msg: PushMessage, siteUrl: string): Promise<PushOutcome> {
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
        webpush: { fcm_options: { link: `${siteUrl}${msg.path}` } },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
    signal: AbortSignal.timeout(FCM_TIMEOUT_MS),
  });
  if (res.ok) return { result: 'ok' };
  const body = (await res.json().catch(() => null)) as FcmErrorBody | null;
  const code = fcmErrorCode(res.status, body);
  // 받아 둔 접근 토큰이 거절됐으면 다음엔 새로 받는다(APNs·웹 푸시 키 문제인 THIRD_PARTY_AUTH_ERROR는 우리 접근 토큰 탓이 아니다)
  if (res.status === 401 && code !== 'THIRD_PARTY_AUTH_ERROR') cached = null;
  return { result: classifyFcmError(res.status, body), code };
}
