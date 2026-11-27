import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_MAX, TITLE_MAX, fallbackTitle, gatherInsights, insightKey, pushCopy, pushTitle, type PushInsight } from '../push-copy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const insight = (over: Partial<PushInsight> = {}): PushInsight => ({ headline: '신경 쓰는 대출 이자, 내려갈 때가 늦어져요', about: '대출 이자', ...over });

test('알림 제목: 알림 한 줄(hook)이 있으면 그것', () => {
  assert.equal(pushTitle(insight({ hook: '기준금리 2년 만에 인상, 대출 이자가 올라요' })), '기준금리 2년 만에 인상, 대출 이자가 올라요');
});

test('알림 제목: 한 줄이 없으면 첫 흐름(핵심 이슈)의 핵심 사실(형식 17)', () => {
  assert.equal(pushTitle(insight({ fact: '나스닥 장중 4.6% 급락 후 낙폭 축소' })), '나스닥 장중 4.6% 급락 후 낙폭 축소');
  assert.equal(pushTitle(insight({ hook: '나스닥 장중 4.6% 급락', fact: '나스닥 장중 4.6% 급락 후 낙폭 축소' })), '나스닥 장중 4.6% 급락');
});

test('알림 제목: 한 줄도 핵심 사실도 없으면(형식 11 이전) 큰 제목. 사정에 안 닿는 큰 제목도 쓴다', () => {
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
  assert.equal(pushTitle(insight({ hook: '코스피 장중  4.6% 급락,\n사이드카까지 발동' })), '코스피 장중 4.6% 급락, 사이드카까지 발동');
  const long = pushTitle(insight({ hook: '가'.repeat(100) }))!;
  assert.equal(long.length, TITLE_MAX);
  assert.ok(long.endsWith('…'));
});

test('알림 본문: 브리핑·소식 수 같은 안내 말 없이 핵심 이슈의 사실 한 줄(2026-11-27 사용자)', () => {
  const copy = pushCopy(insight({ hook: '코스피 5000선 붕괴', note: '장 초반 매도 사이드카까지 발동했어요' }), { title: '첫 소식', short: '요약' });
  assert.deepEqual(copy, { title: '코스피 5000선 붕괴', body: '장 초반 매도 사이드카까지 발동했어요' });
  assert.doesNotMatch(`${copy!.title} ${copy!.body}`, /브리핑|소식 \d+개/);
});

test('알림 본문: 짝인 사실 줄이 없으면 본문 없이 제목만(핵심 사실을 제목으로 쓸 때도)', () => {
  assert.deepEqual(pushCopy(insight({ hook: '코스피 5000선 붕괴' }), null), { title: '코스피 5000선 붕괴', body: '' });
  // 알림 한 줄이 걸러졌으면 그 짝인 본문도 쓰지 않는다(다른 사건 줄과 섞이지 않게)
  assert.deepEqual(pushCopy(insight({ fact: '나스닥 장중 4.6% 급락', note: '엔비디아 3.91% 하락' }), null), { title: '나스닥 장중 4.6% 급락', body: '' });
  assert.deepEqual(pushCopy(insight({ hook: '같은 말', note: '같은 말' }), null), { title: '같은 말', body: '' });
});

test('알림 본문: 흐름이 없으면 첫 소식 제목과 한 줄 요약, 길면 자른다', () => {
  assert.deepEqual(pushCopy(null, { title: '앤트로픽, 상장 4일 만에 공모가 하회', short: '상장 첫날 급등했던 주가가 공모가 아래로 내려왔어요.' }), {
    title: '앤트로픽, 상장 4일 만에 공모가 하회',
    body: '상장 첫날 급등했던 주가가 공모가 아래로 내려왔어요.',
  });
  assert.equal(pushCopy(null, { title: '제목', short: '다'.repeat(100) })!.body.length, BODY_MAX);
  assert.deepEqual(pushCopy(null, { title: '제목', short: null }), { title: '제목', body: '' });
  assert.equal(pushCopy(null, { title: '  ' }), null);
  assert.equal(pushCopy(null, null), null);
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
