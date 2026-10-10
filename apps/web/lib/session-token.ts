// 데모 세션 토큰: `${userId}.${provider}.${서명}`. SESSION_SECRET으로 HMAC-SHA256 서명한다.
// proxy.ts(요청 앞단)와 서버 코드가 같이 쓰므로 Web Crypto만 쓴다. 서명이 없거나 틀리면 로그인 안 한 것으로 본다.
// 애플·구글 로그인(Supabase Auth)이 붙으면 이 토큰 대신 Supabase 세션 쿠키를 본다.

export type Provider = 'apple' | 'google';
export interface Session {
  userId: string;
  provider: Provider;
}

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 없어요(.env.local)');
  keyPromise ??= crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return keyPromise;
}

const toB64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function signSession(s: Session): Promise<string> {
  const body = `${s.userId}.${s.provider}`;
  return `${body}.${toB64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(body)))}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  const m = token?.match(/^([0-9a-f-]{36})\.(apple|google)\.([\w-]+)$/);
  if (!m) return null;
  const sig = fromB64url(m[3]!);
  if (!sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(), sig, enc.encode(`${m[1]}.${m[2]}`));
  return ok ? { userId: m[1]!, provider: m[2] as Provider } : null;
}
