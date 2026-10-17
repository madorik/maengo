import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

// 바깥 주소만 여는 GET(2026-10-17). 사용자가 넣은 링크와 그 피드의 글 주소를 서버가 열기 때문에(SSRF),
// 호스트 이름이 아니라 실제로 연결할 IP를 연결 직전(DNS 조회 결과)에 본다. 내부 IP로 가는 도메인이나 DNS 리바인딩도 여기서 끊긴다.
// 리다이렉트는 손으로 따라가며 한 번마다 같은 검사를 한다. 포트는 기본(80·443)만, 주소 안의 아이디·비밀번호는 받지 않는다. 크기·시간 제한.

const BLOCKED = new BlockList();
// 사설·루프백·링크 로컬(클라우드 메타데이터 169.254.169.254)·CGNAT·문서용·벤치마크·멀티캐스트·예약 대역
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv4');
// IPv6: 미지정·루프백·NAT64(안에 IPv4를 담는다)·폐기용·Teredo·문서용·6to4·고유 로컬·링크 로컬·멀티캐스트. IPv4 매핑(::ffff:a.b.c.d)은 BlockList가 IPv4 규칙으로 본다
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv6');

/** 열면 안 되는 IP인지(사설·예약 대역). IP가 아니면 true(모르는 건 막는다) */
export function isBlockedIp(address: string): boolean {
  const family = isIP(address);
  if (!family) return true;
  return BLOCKED.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/** 막힌 주소로 가려 했다(사설 IP로 풀리는 도메인, IP 주소 그대로, 다른 포트, 주소 안의 계정) */
export class BlockedAddressError extends Error {}

/** DNS 조회 결과를 연결 전에 본다. 하나라도 막힌 대역이면 연결하지 않는다 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const bad = addresses.find((a) => isBlockedIp(a.address));
    if (!addresses.length || bad) return callback(new BlockedAddressError(`${hostname} → ${bad?.address ?? '주소 없음'}`), '');
    if ((options as LookupAllOptions).all) callback(null, addresses as LookupAddress[]);
    else callback(null, addresses[0]!.address, addresses[0]!.family);
  });
};

interface Hop {
  status: number;
  location: string | null;
  body: string;
}

/** 한 번 요청한다(리다이렉트는 따라가지 않고 location만 돌려준다). 본문은 maxBytes에서 자른다 */
function requestOnce(u: URL, headers: Record<string, string>, timeoutMs: number, maxBytes: number): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    // agent: false — 이 요청만의 연결이라 다른 코드가 열어 둔 연결(검사 안 한 IP)을 다시 쓰지 않는다
    const req = mod.request(
      u,
      { method: 'GET', headers: { ...headers, 'accept-encoding': 'gzip, deflate, br' }, agent: false, lookup: safeLookup, signal: AbortSignal.timeout(timeoutMs) },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          res.resume();
          return resolve({ status, location: status >= 300 && status < 400 ? (res.headers.location ?? null) : null, body: '' });
        }
        const len = Number(res.headers['content-length'] ?? 0);
        if (len > maxBytes) {
          res.destroy();
          return reject(new Error(`너무 커요(${len} bytes)`));
        }
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const body: Readable =
          enc === 'gzip' || enc === 'x-gzip' ? res.pipe(createGunzip()) : enc === 'deflate' ? res.pipe(createInflate()) : enc === 'br' ? res.pipe(createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve({ status, location: null, body: new TextDecoder().decode(Buffer.concat(chunks)) });
        };
        const fail = (e: Error) => {
          if (settled) return;
          settled = true;
          reject(e);
        };
        body.on('data', (c: Buffer) => {
          if (settled) return;
          const room = maxBytes - size;
          chunks.push(c.length > room ? c.subarray(0, room) : c);
          size += Math.min(c.length, room);
          if (size >= maxBytes) {
            done();
            res.destroy();
          }
        });
        body.on('end', done);
        body.on('error', fail);
        res.on('error', fail);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export interface SafeGetOptions {
  headers?: Record<string, string>;
  /** 요청 한 번(리다이렉트 한 번)마다 */
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** https만(사용자가 넣은 링크와 그 피드). 리다이렉트도 https로만 */
  httpsOnly?: boolean;
  /** 리다이렉트 한 번마다 더 볼 검사(던지면 멈춘다) */
  check?: (u: URL) => void;
}

/**
 * 바깥 주소를 GET으로 연다. 막힌 주소면 BlockedAddressError, 2xx가 아니면 status가 붙은 Error를 던진다.
 * 돌려주는 url은 리다이렉트 뒤 마지막 주소
 */
export async function safeGet(url: string, opts: SafeGetOptions = {}): Promise<{ text: string; url: string }> {
  const { headers = {}, timeoutMs = 20_000, maxBytes = 3_000_000, maxRedirects = 5, httpsOnly = false, check } = opts;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'https:' && (httpsOnly || u.protocol !== 'http:')) throw new Error(`열 수 없는 주소(${u.protocol})`);
    // URL 파서가 기본 포트(80·443)는 지워 두므로 남아 있으면 다른 포트다
    if (u.port) throw new BlockedAddressError(`포트 ${u.port}`);
    if (u.username || u.password) throw new BlockedAddressError('주소 안의 아이디·비밀번호');
    // IP 주소 그대로면 DNS 조회를 거치지 않으니 여기서 본다
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && isBlockedIp(host)) throw new BlockedAddressError(host);
    check?.(u);
    const r = await requestOnce(u, headers, timeoutMs, maxBytes);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) throw new Error(`HTTP ${r.status}`);
      current = new URL(r.location, current).toString();
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    return { text: r.body, url: current };
  }
  throw new Error('리다이렉트가 너무 많아요');
}
