import 'server-only';

// 홈 화면 위젯(앱 1.3부터)이 로그인 쿠키 없이 오늘 소식을 받아 갈 때 쓰는 토큰: `w1.<회원 id>.<서명>`.
// 데모 세션과 같은 SESSION_SECRET으로 HMAC-SHA256 서명하되, 서명하는 글에 'widget.v1.'을 붙여 세션 토큰과 서로 바꿔 쓸 수 없게 한다.
// 위젯이 보는 건 오늘 소식 제목뿐이라 기한은 두지 않는다. 로그아웃하면 앱이 위젯에서 지우고(lib/native/widget.ts), 탈퇴하면 회원이 없어 401.
// 모두 무효로 하려면 버전(v1)을 올린다.

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 없어요(.env.local)');
  keyPromise ??= crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return keyPromise;
}

const message = (userId: string) => enc.encode(`widget.v1.${userId}`);
const toB64url = (buf: ArrayBuffer) => Buffer.from(buf).toString('base64url');

export async function signWidgetToken(userId: string): Promise<string> {
  return `w1.${userId}.${toB64url(await crypto.subtle.sign('HMAC', await key(), message(userId)))}`;
}

/** 맞는 토큰이면 회원 id, 아니면 null */
export async function readWidgetToken(token: string | null | undefined): Promise<string | null> {
  const m = token?.match(/^w1\.([0-9a-f-]{36})\.([\w-]+)$/);
  if (!m) return null;
  const sig = new Uint8Array(Buffer.from(m[2]!, 'base64url'));
  return (await crypto.subtle.verify('HMAC', await key(), sig, message(m[1]!))) ? m[1]! : null;
}
