import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlockedAddressError, isBlockedIp, safeGet } from '../safe-http';

test('막는 IP: 사설·루프백·링크 로컬·CGNAT·IPv6 내부·IPv4 매핑', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::7f00:1', '2002:7f00:1::1', '아님']) {
    assert.ok(isBlockedIp(ip), ip);
  }
});

test('여는 IP: 공인 주소', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '211.249.220.24', '2606:4700:4700::1111', '2404:6800:4004::200e']) {
    assert.ok(!isBlockedIp(ip), ip);
  }
});

test('safeGet: 요청 전에 막는 주소', async () => {
  await assert.rejects(safeGet('https://127.0.0.1/'), BlockedAddressError);
  await assert.rejects(safeGet('https://[::1]/'), BlockedAddressError);
  await assert.rejects(safeGet('https://example.com:8443/'), BlockedAddressError);
  await assert.rejects(safeGet('https://user:pw@example.com/'), BlockedAddressError);
  // localhost는 이름 검사가 없어도 DNS 결과(127.0.0.1·::1)에서 막힌다
  await assert.rejects(safeGet('http://localhost/'), BlockedAddressError);
});

test('safeGet: https만일 때 http·다른 프로토콜은 열지 않음', async () => {
  await assert.rejects(safeGet('http://example.com/', { httpsOnly: true }), /열 수 없는 주소/);
  await assert.rejects(safeGet('ftp://example.com/'), /열 수 없는 주소/);
});
