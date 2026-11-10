import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DEFAULT_SITE_ORIGIN } from '@maengo/core/site';
import { withBase } from '../base-path';
import type { YoutubeSections } from '../youtube-sections';
import { YOUTUBE_SCOPE, youtubeInterestsEnabled } from './youtube-interests';

// 구글 로그인을 우리 도메인에서 받는다. Supabase OAuth를 거치면 구글 화면에 "…supabase.co로 이동"이 보여서,
// 구글 → {도메인}/maengo/auth/google/callback 으로 받고 코드를 ID 토큰으로 바꿔 Supabase signInWithIdToken으로 세션을 만든다.
// - 웹: state를 쿠키(STATE_COOKIE)와 맞춰 본다.
// - 앱: 로그인은 시스템 브라우저에서 해서 웹뷰 쿠키가 없다. ID 토큰을 암호화한 일회용 코드(gcode)를 딥링크로 앱에 넘기고,
//   웹뷰가 /auth/callback?gcode=… 를 열면 /api/auth/app이 웹뷰에 심어 둔 확인값(VERIFIER_COOKIE)과 맞을 때만 세션을 만든다.
// 구글 콘솔(OAuth 클라이언트)에 돌아올 주소를 등록한 뒤 GOOGLE_DIRECT_LOGIN=1로 켠다. 꺼져 있으면 예전처럼 Supabase OAuth.

export const STATE_COOKIE = 'maengo_g_state';
export const VERIFIER_COOKIE = 'maengo_g_verifier';
/** 로그인 시작부터 돌아올 때까지 */
export const LOGIN_TTL_SEC = 600;
/** gcode는 딥링크로 돌아온 바로 다음에 쓴다 */
const GCODE_TTL_SEC = 120;

/**
 * 구글 콘솔에 돌아올 주소({도메인}/maengo/auth/google/callback)를 등록한 도메인. 첫 번째가 기본(앱 로그인은 늘 여기로 받는다).
 * 로컬에서 시험하려면 GOOGLE_DIRECT_ORIGINS=http://localhost:3100 처럼 등록한 곳을 넣는다.
 */
const fromEnv = process.env.GOOGLE_DIRECT_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = fromEnv?.length ? fromEnv : [new URL(DEFAULT_SITE_ORIGIN).origin];

export const googleDirectEnabled = () =>
  process.env.GOOGLE_DIRECT_LOGIN === '1' && !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/** 이 도메인으로 받을 수 있으면 그 도메인, 아니면 null(웹은 예전처럼 Supabase OAuth로) */
export const allowedOrigin = (origin: string | null | undefined): string | null => (origin && ORIGINS.includes(origin) ? origin : null);

/** 앱 로그인이 돌아올 도메인. 시스템 브라우저에서 받고 gcode는 딥링크로 웹뷰에 가므로 웹뷰 도메인(1.1은 maengo.vercel.app)과 달라도 된다 */
export const appCallbackOrigin = (origin: string | null | undefined): string => allowedOrigin(origin) ?? ORIGINS[0];

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET이 없어요');
  return s;
}
const b64u = (b: Buffer) => b.toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
export const randomToken = () => b64u(randomBytes(24));
export const hashToken = (s: string) => b64u(createHash('sha256').update(s).digest());

type State = { o: string; exp: number } & ({ f: 'web'; r: string } | { f: 'app'; v: string });
type StateInput = { o: string } & ({ f: 'web'; r: string } | { f: 'app'; v: string });

/** 구글에 넘기는 state: 흐름·돌아올 도메인·확인값을 서명해 담는다 */
export function signState(s: StateInput): string {
  const body = b64u(Buffer.from(JSON.stringify({ ...s, exp: now() + LOGIN_TTL_SEC })));
  return `${body}.${b64u(createHmac('sha256', secret()).update(`g-state.${body}`).digest())}`;
}

export function readState(token: string | null): State | null {
  const [body, mac] = token?.split('.') ?? [];
  if (!body || !mac) return null;
  const want = createHmac('sha256', secret()).update(`g-state.${body}`).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as State;
    return s.exp >= now() && allowedOrigin(s.o) ? s : null;
  } catch {
    return null;
  }
}

const callbackUrl = (origin: string) => `${origin}${withBase('/auth/google/callback')}`;

export function googleAuthUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(origin),
    response_type: 'code',
    // 유튜브 구독으로 관심사 찾기(YOUTUBE_INTERESTS=1, 2026-11-10): 같은 로그인 화면에서 유튜브 읽기 권한도 묻는다
    scope: youtubeInterestsEnabled() ? `openid email profile ${YOUTUBE_SCOPE}` : 'openid email profile',
    ...(youtubeInterestsEnabled() ? { include_granted_scopes: 'true' } : {}),
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export interface GoogleTokens {
  idToken: string;
  /** 유튜브 구독을 읽을 때만 쓰고 저장하지 않는다 */
  accessToken: string | null;
  /** 사용자가 허락한 범위(공백으로 구분) */
  scope: string | null;
}

/** 구글이 준 코드 → ID 토큰(과 접근 토큰). 실패하면 null */
export async function exchangeCode(origin: string, code: string): Promise<GoogleTokens | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(origin),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    console.error('[auth] 구글 코드 교환 실패', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const body = (await res.json()) as { id_token?: string; access_token?: string; scope?: string };
  return body.id_token ? { idToken: body.id_token, accessToken: body.access_token ?? null, scope: body.scope ?? null } : null;
}

// gcode = AES-256-GCM(ID 토큰, 확인값 해시, 만료). 키는 SESSION_SECRET에서 만든다
const gcodeKey = () => createHash('sha256').update(`maengo-gcode.${secret()}`).digest();

/** youtube: 시스템 브라우저에서 찾은 유튜브 관심 분야(앱 웹뷰에는 그 브라우저 쿠키가 없어서 같이 싸서 넘긴다) */
export function sealGcode(idToken: string, verifierHash: string, youtube: YoutubeSections | null = null): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', gcodeKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify({ t: idToken, v: verifierHash, exp: now() + GCODE_TTL_SEC, ...(youtube ? { y: youtube } : {}) }), 'utf8'), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), data]));
}

/** 확인값이 맞고 만료 전이면 ID 토큰(과 찾은 유튜브 관심 분야), 아니면 null */
export function openGcode(gcode: string, verifier: string | undefined): { idToken: string; youtube: YoutubeSections | null } | null {
  if (!verifier) return null;
  try {
    const buf = Buffer.from(gcode, 'base64url');
    const d = createDecipheriv('aes-256-gcm', gcodeKey(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const p = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')) as { t: string; v: string; exp: number; y?: YoutubeSections };
    return p.exp >= now() && p.v === hashToken(verifier) ? { idToken: p.t, youtube: p.y ?? null } : null;
  } catch {
    return null;
  }
}
