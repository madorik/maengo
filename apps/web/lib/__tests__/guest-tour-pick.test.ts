import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CategoryId } from '@maengo/core/categories';
import { pickGuestItems } from '../guest-tour-pick';

const c = (id: string, category: CategoryId, score: number, premium = true) => ({ id, category, score, premium });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

test('최대 개수까지만 고른다', () => {
  const all = Array.from({ length: 15 }, (_, i) => c(`n${i}`, (['ai', 'finance', 'tech'] as const)[i % 3], 15 - i));
  assert.equal(pickGuestItems(all, 10, 3).length, 10);
  assert.equal(pickGuestItems(all.slice(0, 4), 10, 3).length, 4);
  assert.deepEqual(pickGuestItems([], 10, 3), []);
});

test('한 분야는 먼저 perCategory개까지, 다른 분야가 있으면 점수가 낮아도 넣는다', () => {
  const all = [c('a1', 'ai', 9), c('a2', 'ai', 8), c('a3', 'ai', 7), c('a4', 'ai', 6), c('f1', 'finance', 1)];
  const out = pickGuestItems(all, 4, 3);
  assert.deepEqual(new Set(ids(out)), new Set(['a1', 'a2', 'a3', 'f1']));
});

test('다른 분야가 모자라면 남은 순서대로 채운다', () => {
  const all = [c('a1', 'ai', 9), c('a2', 'ai', 8), c('a3', 'ai', 7), c('a4', 'ai', 6), c('a5', 'ai', 5)];
  assert.deepEqual(ids(pickGuestItems(all, 4, 3)), ['a1', 'a2', 'a3', 'a4']);
});

test('Premium 목소리 소식이 점수와 상관없이 먼저 온다', () => {
  const all = [c('basic', 'ai', 100, false), c('prem', 'finance', 1, true)];
  assert.deepEqual(ids(pickGuestItems(all, 10, 3)), ['prem', 'basic']);
});

test('같은 분야가 잇따르지 않게 섞되, 같은 목소리 묶음 안에서만 섞는다', () => {
  const all = [c('a1', 'ai', 9), c('a2', 'ai', 8), c('f1', 'finance', 7), c('a3', 'ai', 6), c('t1', 'tech', 5), c('b1', 'ai', 4, false), c('b2', 'ai', 3, false)];
  const out = pickGuestItems(all, 10, 3);
  assert.deepEqual(ids(out), ['a1', 'f1', 'a2', 't1', 'a3', 'b1', 'b2']);
});
