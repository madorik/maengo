import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contextFacts, pickQuestion, type UserContext } from '../context';
import type { FeedItem } from '../types';

const item = (title: string, short = ''): FeedItem => ({ title, short } as FeedItem);
const at = (value: string, updatedAt = new Date().toISOString()) => ({ value, updatedAt });
const B = '2026-11-11:am';

test('주식 소식이 있고 모르면 "주식 하세요?"를 묻는다', () => {
  assert.equal(pickQuestion({}, [item('코스피 5000선 공방')], B)?.key, 'stock');
});

test('주식을 한다고 하면 같은 브리핑에서 바로 국내·미국을 이어 묻는다', () => {
  const ctx: UserContext = { stock: at('yes'), _asked: at(B) };
  assert.equal(pickQuestion(ctx, [item('코스피 5000선 공방')], B)?.key, 'stock_market');
});

test('새 질문은 브리핑마다 하나만', () => {
  const ctx: UserContext = { stock: at('no'), _asked: at(B) };
  assert.equal(pickQuestion(ctx, [item('코스피 급락'), item('비트코인 10만 달러')], B), null);
  assert.equal(pickQuestion(ctx, [item('비트코인 10만 달러')], '2026-11-11:pm')?.key, 'crypto');
});

test('관계있는 소식이 없으면 묻지 않는다', () => {
  assert.equal(pickQuestion({}, [item('피아니스트 김정환, 국제 콩쿠르 우승')], B), null);
});

test('나중에는 7일 동안 다시 묻지 않는다', () => {
  const recent: UserContext = { stock: at('skip') };
  assert.equal(pickQuestion(recent, [item('코스피 급락')], B), null);
  const old: UserContext = { stock: at('skip', new Date(Date.now() - 8 * 86_400_000).toISOString()) };
  assert.equal(pickQuestion(old, [item('코스피 급락')], B)?.key, 'stock');
});

test('인사이트에 주는 사정: 답한 것만, 이어 묻는 답은 앞 답이 맞을 때만', () => {
  assert.deepEqual(contextFacts({ stock: at('yes'), stock_market: at('us'), loan: at('variable'), crypto: at('skip'), _asked: at(B) }), [
    '주식을 해요',
    '미국 주식(미장)을 해요',
    '변동금리 대출이 있어요',
  ]);
  assert.deepEqual(contextFacts({ stock: at('no'), stock_market: at('kr') }), ['주식은 안 해요']);
});
