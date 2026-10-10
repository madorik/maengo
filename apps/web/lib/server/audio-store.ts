import 'server-only';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';

// 듣기 음성 파일 저장소. R2 키가 있으면 R2(비공개 버킷 + 서명 URL), 없으면 로컬 디스크(.cache/audio-store).
// 키는 내용 해시라 한 번 올린 파일은 바뀌지 않는다(immutable).

export interface AudioStore {
  readonly kind: 'r2' | 'local';
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
  /** 브라우저가 바로 받을 주소. R2면 서명 URL(몇 시간 유효) */
  url(key: string): Promise<string>;
}

/** audio/seg/<key>.mp3, audio/ep/<hash>.mp3 만 허용한다(로컬 파일 경로로도 쓰이므로) */
export function isAudioKey(key: string): boolean {
  return /^audio\/(seg|ep)\/[\w-]+\.mp3$/.test(key);
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
/** 서명 URL 유효 시간. 시각을 1시간 단위로 내려 같은 시간대에는 같은 주소가 나오게 한다(브라우저 캐시가 먹게) */
const SIGNED_TTL_S = 6 * 3600;

function hourStamp(now = new Date()): string {
  const d = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function r2Store(env: { account: string; bucket: string; id: string; secret: string }): AudioStore {
  const client = new AwsClient({ accessKeyId: env.id, secretAccessKey: env.secret, service: 's3', region: 'auto' });
  const base = `https://${env.account}.r2.cloudflarestorage.com/${env.bucket}`;
  const objectUrl = (key: string) => `${base}/${key}`;
  return {
    kind: 'r2',
    async put(key, bytes, contentType) {
      // R2는 Content-Length가 꼭 있어야 한다. Next 서버의 fetch는 Uint8Array 본문을 스트림으로 보내 길이가 빠지므로 직접 넣는다
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const res = await client.fetch(objectUrl(key), {
        method: 'PUT',
        body,
        headers: { 'content-type': contentType, 'content-length': String(bytes.byteLength), 'cache-control': IMMUTABLE },
      });
      if (!res.ok) throw new Error(`R2 업로드 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
    async get(key) {
      const res = await client.fetch(objectUrl(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 읽기 실패 ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async exists(key) {
      const res = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`R2 확인 실패 ${res.status}`);
      return true;
    },
    async url(key) {
      const signed = await client.sign(new Request(`${objectUrl(key)}?X-Amz-Expires=${SIGNED_TTL_S}`), {
        aws: { signQuery: true, datetime: hourStamp() },
      });
      return signed.url;
    },
  };
}

function localStore(): AudioStore {
  const dir = path.join(process.cwd(), '.cache', 'audio-store');
  const file = (key: string) => {
    if (!isAudioKey(key)) throw new Error(`잘못된 음성 키: ${key}`);
    return path.join(dir, key);
  };
  return {
    kind: 'local',
    async put(key, bytes) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), bytes);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(file(key)));
      } catch {
        return null;
      }
    },
    async exists(key) {
      return stat(file(key)).then(() => true, () => false);
    },
    async url(key) {
      return `/api/episode/file?key=${encodeURIComponent(key)}`;
    },
  };
}

function pick(): AudioStore {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const id = process.env.R2_ACCESS_KEY_ID?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (process.env.AUDIO_STORE !== 'local' && account && bucket && id && secret) return r2Store({ account, bucket, id, secret });
  return localStore();
}

export const audioStore = pick();
