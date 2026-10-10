import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, isNotifyTime, kstDate, kstDayLabel, kstGreetingDate, NOTIFY_TIMES, notifyTimeLabel, publishedLabel } from '../util/kst';

test('KST 날짜는 UTC 15시에 넘어간다', () => {
  assert.equal(kstDate(new Date('2026-10-08T14:59:00Z')), '2026-10-08');
  assert.equal(kstDate(new Date('2026-10-08T15:00:00Z')), '2026-10-09');
});

test('인사 날짜와 알림 시각 표기', () => {
  assert.equal(kstGreetingDate(new Date('2026-10-08T22:30:00Z')), '10월 9일 금요일 아침');
  assert.equal(notifyTimeLabel('07:00'), '아침 7시');
  assert.equal(notifyTimeLabel('06:30'), '아침 6시 30분');
  assert.equal(notifyTimeLabel('12:00'), '낮 12시');
  assert.equal(notifyTimeLabel('13:30'), '오후 1시 30분');
  assert.equal(notifyTimeLabel('18:00'), '저녁 6시');
  assert.equal(notifyTimeLabel('23:30'), '밤 11시 30분');
});

test('알림 시간 선택지: 06:00~23:30, 30분 단위', () => {
  assert.equal(NOTIFY_TIMES[0], '06:00');
  assert.equal(NOTIFY_TIMES.at(-1), '23:30');
  assert.equal(NOTIFY_TIMES.length, 36);
  assert.ok(isNotifyTime('07:30'));
  assert.ok(!isNotifyTime('05:30'));
  assert.ok(!isNotifyTime('07:15'));
});

test('작성 시각 표기: 방금 / 오늘 / 어제 / 날짜', () => {
  const now = new Date('2026-10-09T06:00:00Z'); // KST 15:00
  assert.equal(publishedLabel('2026-10-09T05:30:00Z', now), '방금');
  assert.equal(publishedLabel('2026-10-09T00:00:00Z', now), '오늘 오전 9시');
  assert.equal(publishedLabel('2026-10-08T06:00:00Z', now), '어제 오후 3시');
  assert.equal(publishedLabel('2026-10-08T14:00:00Z', now), '어제 오후 11시');
  assert.equal(publishedLabel('2026-10-06T03:00:00Z', now), '10월 6일');
  assert.equal(publishedLabel('2026-10-08T15:00:00Z', now), '오늘 밤 12시');
  assert.equal(publishedLabel('2026-10-09T03:00:00Z', now), '오늘 낮 12시');
});

test('피드 날짜 묶음 이름', () => {
  const now = new Date('2026-10-09T06:00:00Z');
  assert.equal(kstDayLabel('2026-10-09', now), '오늘');
  assert.equal(kstDayLabel('2026-10-08', now), '어제');
  assert.equal(kstDayLabel('2026-10-05', now), '10월 5일 월요일');
});

test('날짜 더하기는 월말·연말을 넘는다', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});
