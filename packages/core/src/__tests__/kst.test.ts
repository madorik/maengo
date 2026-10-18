import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, beforeNotify, fromClock12, isNotifyTime, kstDate, kstDayLabel, kstGreetingDate, notifyTimeLabel, publishedLabel, toClock12 } from '../util/kst';

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
  assert.equal(notifyTimeLabel('00:00'), '밤 12시');
  assert.equal(notifyTimeLabel('00:30'), '밤 12시 30분');
  assert.equal(notifyTimeLabel('05:10'), '새벽 5시 10분');
  assert.equal(notifyTimeLabel('07:05'), '아침 7시 5분');
});

test('알림 시간: 하루 아무 때나 1분 단위, 오전/오후·시·분 변환', () => {
  for (const v of ['00:00', '05:30', '07:15', '12:00', '23:59']) assert.ok(isNotifyTime(v), v);
  for (const v of ['24:00', '7:00', '07:60', '07:5', '', null, 700]) assert.ok(!isNotifyTime(v), String(v));
  assert.deepEqual(toClock12('00:05'), { pm: false, hour: 12, minute: 5 });
  assert.deepEqual(toClock12('06:00'), { pm: false, hour: 6, minute: 0 });
  assert.deepEqual(toClock12('12:30'), { pm: true, hour: 12, minute: 30 });
  assert.deepEqual(toClock12('23:59'), { pm: true, hour: 11, minute: 59 });
  assert.equal(fromClock12(false, 12, 5), '00:05');
  assert.equal(fromClock12(false, 6, 0), '06:00');
  assert.equal(fromClock12(true, 12, 30), '12:30');
  assert.equal(fromClock12(true, 11, 59), '23:59');
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

test('알림 시각 전인지는 KST로 본다', () => {
  // 2026-10-14 07:59 KST = 2026-10-13T22:59Z
  assert.equal(beforeNotify('08:00', new Date('2026-10-13T22:59:00Z')), true);
  assert.equal(beforeNotify('08:00', new Date('2026-10-13T23:00:00Z')), false);
  // 00시 1분(KST)은 아침 6시 전
  assert.equal(beforeNotify('06:00', new Date('2026-10-13T15:01:00Z')), true);
  assert.equal(beforeNotify('21:30', new Date('2026-10-14T12:30:00Z')), false);
});

test('배송을 기다리는 10분도 같은 KST 날짜의 알림 시각으로 본다(자정 직후)', () => {
  const grace = 10 * 60_000;
  // 2026-10-14 00:05 KST: 아침 8시 알림은 아직 전(예전엔 '어제 23:55'로 봐서 알림 뒤가 됐다)
  assert.equal(beforeNotify('08:00', new Date('2026-10-13T15:05:00Z'), grace), true);
  // 08:05는 배송을 기다리는 중, 08:10부터는 알림 뒤
  assert.equal(beforeNotify('08:00', new Date('2026-10-13T23:05:00Z'), grace), true);
  assert.equal(beforeNotify('08:00', new Date('2026-10-13T23:10:00Z'), grace), false);
  // 밤 11시 55분 알림: 23:58은 기다리는 중, 다음 날 00:03은 그날 알림 전
  assert.equal(beforeNotify('23:55', new Date('2026-10-14T14:58:00Z'), grace), true);
  assert.equal(beforeNotify('23:55', new Date('2026-10-14T15:03:00Z'), grace), true);
  // 자정 알림: 00:05는 기다리는 중, 00:10부터 알림 뒤
  assert.equal(beforeNotify('00:00', new Date('2026-10-13T15:05:00Z'), grace), true);
  assert.equal(beforeNotify('00:00', new Date('2026-10-13T15:10:00Z'), grace), false);
});

test('날짜 더하기는 월말·연말을 넘는다', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});
