import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, createHash, timingSafeEqual } from 'node:crypto';

// 공유 주소(/s/<토큰>)의 토큰(2026-11-08 사용자: 글 번호가 주소에 보이면 번호를 바꿔 모든 글을 볼 수 있다).
// 16바이트 한 덩어리 = [소식 번호 8바이트][그 번호의 HMAC 앞 8바이트]를 AES-128로 암호화해 base64url 22자로 쓴다.
// 서버의 SESSION_SECRET 없이는 만들 수도 풀 수도 없고, 한 글자만 바꿔도 HMAC이 맞지 않아 없는 소식이 된다. 같은 소식은 늘 같은 토큰(미리보기 캐시가 맞는다).
// 모두 무효로 하려면 버전(v1)을 올린다.

let keys: { aes: Buffer; mac: Buffer } | null = null;

function keyring() {
  if (keys) return keys;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 없어요(.env.local)');
  keys = {
    aes: createHash('sha256').update(`share.aes.v1.${secret}`).digest().subarray(0, 16),
    mac: createHash('sha256').update(`share.mac.v1.${secret}`).digest(),
  };
  return keys;
}

function macOf(id: Buffer): Buffer {
  return createHmac('sha256', keyring().mac).update(id).digest().subarray(0, 8);
}

/** 소식 번호 → 공유 토큰(22자) */
export function encodeShareToken(clusterId: number): string {
  const id = Buffer.alloc(8);
  id.writeBigUInt64BE(BigInt(clusterId));
  const c = createCipheriv('aes-128-ecb', keyring().aes, null).setAutoPadding(false);
  return Buffer.concat([c.update(Buffer.concat([id, macOf(id)])), c.final()]).toString('base64url');
}

/** 공유 토큰 → 소식 번호. 맞지 않는 토큰(옛 숫자 주소 포함)이면 null */
export function decodeShareToken(token: string): number | null {
  if (!/^[\w-]{22}$/.test(token)) return null;
  const ct = Buffer.from(token, 'base64url');
  if (ct.length !== 16) return null;
  const d = createDecipheriv('aes-128-ecb', keyring().aes, null).setAutoPadding(false);
  const plain = Buffer.concat([d.update(ct), d.final()]);
  const id = plain.subarray(0, 8);
  if (!timingSafeEqual(plain.subarray(8), macOf(id))) return null;
  const n = Number(id.readBigUInt64BE());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 공유 주소 경로(basePath 없이) */
export const sharePath = (clusterId: number) => `/s/${encodeShareToken(clusterId)}`;
