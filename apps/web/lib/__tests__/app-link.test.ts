import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appLinkPath } from '../app-client';

test('위젯 딥링크 → 앱 안 경로', () => {
  assert.equal(appLinkPath('kr.maengo.app://open/article/123?from=widget'), '/article/123?from=widget');
  assert.equal(appLinkPath('kr.maengo.app://open/today'), '/today');
  assert.equal(appLinkPath('kr.maengo.app://open/library?from=widget'), '/library?from=widget');
});

test('열면 안 되는 주소는 null', () => {
  assert.equal(appLinkPath('kr.maengo.app://auth/callback?code=x'), null);
  assert.equal(appLinkPath('kr.maengo.app://open/settings'), null);
  assert.equal(appLinkPath('kr.maengo.app://open/article/12x'), null);
  assert.equal(appLinkPath('https://evil.example/open/today'), null);
  assert.equal(appLinkPath('kr.maengo.app://open//evil.example'), null);
  assert.equal(appLinkPath('kr.maengo.app://open/today?from=<script>'), '/today');
  assert.equal(appLinkPath('not a url'), null);
});
