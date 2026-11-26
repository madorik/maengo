import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TITLE_MAX, fallbackTitle, gatherInsights, insightKey, pushBody, pushTitle, type PushInsight } from '../push-copy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const insight = (over: Partial<PushInsight> = {}): PushInsight => ({ headline: '신경 쓰는 대출 이자, 내려갈 때가 늦어져요', about: '대출 이자', ...over });

test('알림 제목: 알림 한 줄(hook)이 있으면 그것', () => {
  assert.equal(pushTitle(insight({ hook: '기준금리 0.25%p 인상, 대출 이자는?' })), '기준금리 0.25%p 인상, 대출 이자는?');
});

test('알림 제목: 한 줄이 없으면(형식 16 이전·거르기에 걸림) 큰 제목. 사정에 안 닿는 큰 제목도 쓴다', () => {
  assert.equal(pushTitle(insight()), '신경 쓰는 대출 이자, 내려갈 때가 늦어져요');
  assert.equal(pushTitle(insight({ hook: '  ' })), '신경 쓰는 대출 이자, 내려갈 때가 늦어져요');
  assert.equal(pushTitle(insight({ about: '', headline: 'AI 투자 회의론, 기술주 하락 압력이 이어져요' })), 'AI 투자 회의론, 기술주 하락 압력이 이어져요');
});

test('알림 제목: 흐름이 없거나 비면 null(첫 소식 제목으로)', () => {
  assert.equal(pushTitle(null), null);
  assert.equal(pushTitle(undefined), null);
  assert.equal(pushTitle(insight({ headline: '  ' })), null);
});

test('알림 제목: 공백을 정리하고 너무 길면 줄임표로 자른다', () => {
  assert.equal(pushTitle(insight({ hook: '빗썸 해킹  유출,\n내 정보도 포함됐을까요?' })), '빗썸 해킹 유출, 내 정보도 포함됐을까요?');
  const long = pushTitle(insight({ hook: '가'.repeat(100) }))!;
  assert.equal(long.length, TITLE_MAX);
  assert.ok(long.endsWith('…'));
});

test('알림 본문: 어느 브리핑인지와 소식 수만(제목의 답을 말하지 않는다)', () => {
  assert.equal(pushBody('am', 10), '출근길 브리핑 · 소식 10개');
  assert.equal(pushBody('pm', 4), '퇴근길 브리핑 · 소식 4개');
});

test('첫 소식 제목: 비면 null, 길면 자른다', () => {
  assert.equal(fallbackTitle(null), null);
  assert.equal(fallbackTitle('  '), null);
  assert.equal(fallbackTitle('앤트로픽, 상장 4일 만에 공모가 하회'), '앤트로픽, 상장 4일 만에 공모가 하회');
  assert.equal(fallbackTitle('나'.repeat(80))!.length, TITLE_MAX);
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
