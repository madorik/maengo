import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksForeign } from '../inquiry';

test('영어 문의는 번역할 글로 본다', () => {
  assert.equal(looksForeign("Hi, I subscribed to Premium but the app still shows Free. Can you check?"), true);
  assert.equal(looksForeign('こんにちは。アプリの通知が届きません。確認お願いします。'), true);
});

test('한국어 문의·한국어에 영어 낱말이 섞인 문의·짧은 글은 번역하지 않는다', () => {
  assert.equal(looksForeign('결제했는데 Premium이 안 돼요. 확인 부탁드려요.'), false);
  assert.equal(looksForeign('앱에서 Gemini 답변이 느려요'), false);
  assert.equal(looksForeign('Hello'), false);
  assert.equal(looksForeign('M123456789 주문 번호예요'), false);
});
