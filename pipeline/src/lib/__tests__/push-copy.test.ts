import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_MAX, gatherInsights, insightBody, insightKey, type PushInsight } from '../push-copy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const insight = (over: Partial<PushInsight> = {}): PushInsight => ({ headline: '신경 쓰는 대출 이자, 내려갈 때가 늦어져요', about: '대출 이자', ...over });

test('알림 본문: 사정에 닿는 큰 제목을 쓴다', () => {
  assert.equal(insightBody(insight()), '신경 쓰는 대출 이자, 내려갈 때가 늦어져요');
});

test('알림 본문: 확인할 것이 있으면 큰 제목보다 먼저', () => {
  assert.equal(insightBody(insight({ check: '증권사 앱을 쓴다면 해킹 공지를 확인하고 비밀번호를 바꿔 보세요' })), '증권사 앱을 쓴다면 해킹 공지를 확인하고 비밀번호를 바꿔 보세요');
});

test('알림 본문: 사정에 닿는 게 없으면(about이 비면) 큰 제목은 쓰지 않는다 → 첫 소식 제목으로', () => {
  assert.equal(insightBody(insight({ about: '' })), null);
  assert.equal(insightBody(insight({ about: '   ' })), null);
});

test('알림 본문: 사정에 안 닿아도 확인할 것은 쓴다(조건을 단 할 일이라 누구에게나 맞다)', () => {
  assert.equal(insightBody(insight({ about: '', check: '리콜 대상이라면 센터 예약을 확인해 보세요' })), '리콜 대상이라면 센터 예약을 확인해 보세요');
});

test('알림 본문: 흐름이 없거나 비면 null', () => {
  assert.equal(insightBody(null), null);
  assert.equal(insightBody(undefined), null);
  assert.equal(insightBody(insight({ headline: '  ' })), null);
});

test('알림 본문: 공백을 정리하고 너무 길면 줄임표로 자른다', () => {
  assert.equal(insightBody(insight({ headline: '하시는  미국 주식,\n이번 하락은 엔비디아만의 악재예요' })), '하시는 미국 주식, 이번 하락은 엔비디아만의 악재예요');
  const long = insightBody(insight({ headline: '가'.repeat(200) }))!;
  assert.equal(long.length, BODY_MAX);
  assert.ok(long.endsWith('…'));
});

test('흐름 모으기: 사람·브리핑마다 결과를 담는다', async () => {
  const got = await gatherInsights(
    [
      { userId: 'a', slot: 'am' },
      { userId: 'a', slot: 'pm' },
      { userId: 'b', slot: 'am' },
    ],
    async (id, slot) => (id === 'b' ? null : insight({ headline: `${id}-${slot}` })),
    { totalMs: 1000, perUserMs: 500, concurrency: 2 },
  );
  assert.equal(got.get(insightKey('a', 'am'))?.headline, 'a-am');
  assert.equal(got.get(insightKey('a', 'pm'))?.headline, 'a-pm');
  assert.equal(got.get(insightKey('b', 'am')), null);
});

test('흐름 모으기: 한 사람이 던져도 다른 사람은 그대로, 그 사람은 null', async () => {
  const got = await gatherInsights(
    [
      { userId: 'a', slot: 'am' },
      { userId: 'b', slot: 'am' },
    ],
    async (id) => {
      if (id === 'a') throw new Error('Gemini 오류');
      return insight();
    },
    { totalMs: 1000, perUserMs: 500, concurrency: 2 },
  );
  assert.equal(got.get(insightKey('a', 'am')), null);
  assert.ok(got.get(insightKey('b', 'am')));
});

test('흐름 모으기: 한 사람이 너무 오래 걸리면 그 사람만 null', async () => {
  const got = await gatherInsights(
    [
      { userId: 'slow', slot: 'am' },
      { userId: 'fast', slot: 'am' },
    ],
    async (id) => {
      if (id === 'slow') await sleep(300);
      return insight({ headline: id });
    },
    { totalMs: 1000, perUserMs: 40, concurrency: 2 },
  );
  assert.equal(got.get(insightKey('slow', 'am')), null);
  assert.equal(got.get(insightKey('fast', 'am'))?.headline, 'fast');
});

test('흐름 모으기: 늦게 던진 요청이 처리되지 않은 거절이 되지 않는다', async () => {
  let unhandled = false;
  const onUnhandled = () => (unhandled = true);
  process.once('unhandledRejection', onUnhandled);
  await gatherInsights(
    [{ userId: 'slow', slot: 'am' }],
    async () => {
      await sleep(80);
      throw new Error('늦게 실패');
    },
    { totalMs: 1000, perUserMs: 20, concurrency: 1 },
  );
  await sleep(150);
  process.off('unhandledRejection', onUnhandled);
  assert.equal(unhandled, false);
});

test('흐름 모으기: 전체 시간을 다 쓰면 남은 사람은 null(첫 소식 제목으로 보낸다)', async () => {
  const got = await gatherInsights(
    [
      { userId: 'a', slot: 'am' },
      { userId: 'b', slot: 'am' },
      { userId: 'c', slot: 'am' },
    ],
    async (id) => {
      await sleep(60);
      return insight({ headline: id });
    },
    { totalMs: 80, perUserMs: 500, concurrency: 1 },
  );
  assert.equal(got.get(insightKey('a', 'am'))?.headline, 'a');
  // 둘째는 남은 시간(약 20ms) 안에 못 끝내고, 셋째는 시간이 없다
  assert.equal(got.get(insightKey('b', 'am')), null);
  assert.equal(got.get(insightKey('c', 'am')), null);
});
