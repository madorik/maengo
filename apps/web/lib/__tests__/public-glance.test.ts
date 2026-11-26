import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLANCE_MIN_ITEMS, summarizeMonth, weekLabels, type GlanceRow } from '../public-glance';

const DAY = 24 * 3600_000;
// 한국 시각 2026-11-26 15:00(= UTC 06:00). 오늘은 한국 날짜 11월 26일
const NOW = Date.parse('2026-11-26T06:00:00Z');
// n일 전 한국 낮 12시에 처음 본 소식
const row = (id: number, daysAgo: number, outlets = 1, title = `소식 ${id}`): GlanceRow => {
  const at = new Date(Date.parse('2026-11-26T03:00:00Z') - daysAgo * DAY).toISOString();
  return { clusterId: id, title, firstSeenAt: at, date: at, outlets };
};

test('지난 30일 안의 소식만 세고 주는 오늘부터 7일씩 4주(오래된 주 먼저)', () => {
  const rows = [row(1, 0), row(2, 6), row(3, 7), row(4, 13), row(5, 14), row(6, 20), row(7, 21), row(8, 27), row(9, 28), row(10, 29), row(11, 30), row(12, 45)];
  const m = summarizeMonth(rows, NOW)!;
  assert.equal(m.total, 10, '0~29일 전');
  assert.deepEqual(m.weeks, [2, 2, 2, 2], '21~27일 전 / 14~20 / 7~13 / 0~6일 전. 28·29일 전은 소식 수엔 들어가고 막대엔 안 들어간다');
  assert.equal(m.weeks.length, weekLabels().length);
});

test('날은 한국 날짜 기준이다(한국 자정 전후)', () => {
  const at = (iso: string) => ({ clusterId: 1, title: 't', firstSeenAt: iso, date: iso, outlets: 1 });
  // 11월 25일 23:59 KST(= UTC 14:59)는 1일 전, 11월 26일 00:00 KST(= UTC 15:00 전날)는 오늘
  const m = summarizeMonth([at('2026-11-25T14:59:00Z'), at('2026-11-25T15:00:00Z'), at('2026-11-25T15:01:00Z')], NOW)!;
  assert.deepEqual(m.weeks, [0, 0, 0, 3]);
});

test('소식이 GLANCE_MIN_ITEMS개보다 적으면 칸을 숨긴다(null)', () => {
  assert.equal(GLANCE_MIN_ITEMS, 3);
  assert.equal(summarizeMonth([row(1, 1), row(2, 2)], NOW), null);
  assert.equal(summarizeMonth([row(1, 1), row(2, 2), row(3, 40)], NOW), null, '기간 밖 소식은 세지 않는다');
  assert.notEqual(summarizeMonth([row(1, 1), row(2, 2), row(3, 3)], NOW), null);
});

test('여러 매체가 다룬 소식 3개: 매체 수 많은 순, 같으면 최근 순, 1곳뿐인 소식은 뺀다', () => {
  const m = summarizeMonth([row(1, 1, 1), row(2, 5, 4), row(3, 2, 4), row(4, 9, 6), row(5, 3, 2), row(6, 4, 3)], NOW)!;
  assert.deepEqual(
    m.top.map((t) => [t.clusterId, t.outlets]),
    [
      [4, 6],
      [3, 4],
      [2, 4],
    ],
  );
  const few = summarizeMonth([row(1, 1, 1), row(2, 2, 1), row(3, 3, 2)], NOW)!;
  assert.deepEqual(
    few.top.map((t) => t.clusterId),
    [3],
  );
  assert.deepEqual(summarizeMonth([row(1, 1), row(2, 2), row(3, 3)], NOW)!.top, []);
});

test('미래 시각(시계 어긋남)은 오늘로 센다', () => {
  const m = summarizeMonth([row(1, -1), row(2, 0), row(3, 1)], NOW)!;
  assert.deepEqual(m.weeks, [0, 0, 0, 3]);
});

test('주 이름표는 3주 전, 2주 전, 1주 전, 최근 7일', () => {
  assert.deepEqual(weekLabels(), ['3주 전', '2주 전', '1주 전', '최근 7일']);
});
