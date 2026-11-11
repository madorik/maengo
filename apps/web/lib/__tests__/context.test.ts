import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTEXT_GROUPS, CONTEXT_QUESTIONS, SKIP, contextFacts, followUpOf, pickQuestion, type UserContext } from '../context';
import type { FeedItem } from '../types';

const item = (title: string, short = ''): FeedItem => ({ title, short } as FeedItem);
const at = (value: string, updatedAt = new Date().toISOString()) => ({ value, updatedAt });
const B = '2026-11-11';

test('주식 소식이 있고 모르면 "주식 하세요?"를 묻는다', () => {
  assert.equal(pickQuestion({}, [item('코스피 5000선 공방')], B)?.key, 'stock');
});

test('주식을 한다고 하면 같은 날에도 바로 국내·미국을 이어 묻는다', () => {
  const ctx: UserContext = { stock: at('yes'), _asked: at(B) };
  assert.equal(pickQuestion(ctx, [item('코스피 5000선 공방')], B)?.key, 'stock_market');
});

test('새 질문은 하루에 하나만', () => {
  const ctx: UserContext = { stock: at('no'), _asked: at(B) };
  assert.equal(pickQuestion(ctx, [item('코스피 급락'), item('비트코인 10만 달러')], B), null);
  assert.equal(pickQuestion(ctx, [item('비트코인 10만 달러')], '2026-11-12')?.key, 'crypto');
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

test('이어 묻는 질문', () => {
  assert.equal(followUpOf('stock', 'yes')?.key, 'stock_market');
  assert.equal(followUpOf('stock', 'no'), null);
  assert.equal(followUpOf('home', 'none')?.key, 'apply');
});

test('질문 목록: 키가 겹치지 않고, 이어 묻는 질문의 앞 질문·답이 있고 같은 분야다', () => {
  const keys = CONTEXT_QUESTIONS.map((q) => q.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const q of CONTEXT_QUESTIONS) {
    assert.ok(CONTEXT_GROUPS.includes(q.group), q.key);
    assert.equal(new Set(q.options.map((o) => o.value)).size, q.options.length, q.key);
    assert.ok(!q.options.some((o) => o.value === SKIP), q.key);
    if (!q.after) continue;
    const parent = CONTEXT_QUESTIONS.find((p) => p.key === q.after!.key);
    assert.ok(parent && parent.options.some((o) => o.value === q.after!.value), q.key);
    assert.equal(parent!.group, q.group, q.key);
  }
});

test('나이대는 20대부터', () => {
  assert.deepEqual(CONTEXT_QUESTIONS.find((q) => q.key === 'age')?.options.map((o) => o.label), ['20대', '30대', '40대', '50대', '그 밖']);
});

test('분야별 소식에 맞는 질문을 묻는다', () => {
  const ask = (title: string) => pickQuestion({}, [item(title)], B)?.key;
  assert.equal(ask('SKT 유심 정보 유출, 가입자 2천만 명 영향'), 'carrier');
  assert.equal(ask('서울 지하철 파업 예고'), 'commute');
  assert.equal(ask('전기차 보조금 내년 축소'), 'car');
  assert.equal(ask('원·달러 환율 1,450원 돌파'), 'overseas_pay');
  assert.equal(ask('늘봄학교 전국 초등학교로 확대'), 'kids');
  assert.equal(ask('국민연금 보험료율 13%로'), 'age');
  assert.equal(ask('미국, 한국산 철강에 관세 25%'), 'trade');
  assert.equal(ask('KIA 타이거즈, 한국시리즈 우승'), 'sport');
  assert.equal(ask('넷플릭스 요금 인상'), 'ott');
  assert.equal(ask('유기견 입양 지원 늘린다'), 'pet');
  assert.equal(ask('KTX 운임 인상 검토'), 'commute');
});

test('야구를 본다고 하면 응원 팀을 바로 이어 묻는다', () => {
  assert.equal(followUpOf('sport', 'baseball')?.key, 'kbo_team');
  assert.equal(followUpOf('job', 'it')?.key, 'dev_area');
  assert.equal(followUpOf('sport', 'soccer'), null);
});
