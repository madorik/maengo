import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockText, floorToMinute, kstMinuteOfDay, minuteText, remainingText, upcomingBriefings } from '../briefing-clock';
import { eventsOf } from '../today-empty';

/** KST 시각 → ms */
const kst = (h: number, m: number, s = 0) => Date.UTC(2026, 10, 26, h - 9, m, s);

test('KST 하루 중 몇 번째 분: 브라우저 시간대와 관계없이 같다', () => {
  assert.equal(kstMinuteOfDay(kst(6, 40, 59)), 6 * 60 + 40);
  assert.equal(kstMinuteOfDay(kst(0, 0)), 0);
  assert.equal(kstMinuteOfDay(kst(23, 59, 59)), 23 * 60 + 59);
  assert.equal(floorToMinute(kst(6, 40, 59)), kst(6, 40));
});

test('다음 브리핑: 출근길 시각 전이면 [출근길, 퇴근길]', () => {
  const [next, after] = upcomingBriefings('07:30', '18:00', kst(6, 40, 20));
  assert.deepEqual(next, { slot: 'am', at: '07:30', inMin: 50, tomorrow: false });
  assert.deepEqual(after, { slot: 'pm', at: '18:00', inMin: 11 * 60 + 20, tomorrow: false });
});

test('다음 브리핑: 출근길 뒤 퇴근길 전이면 [퇴근길, 내일 출근길], 퇴근길 뒤면 [내일 출근길, 내일 퇴근길]', () => {
  const [next, after] = upcomingBriefings('07:30', '18:00', kst(14, 0));
  assert.deepEqual(next, { slot: 'pm', at: '18:00', inMin: 4 * 60, tomorrow: false });
  assert.deepEqual(after, { slot: 'am', at: '07:30', inMin: 17 * 60 + 30, tomorrow: true });
  const [n2, a2] = upcomingBriefings('07:30', '18:00', kst(20, 0));
  assert.deepEqual(n2, { slot: 'am', at: '07:30', inMin: 11 * 60 + 30, tomorrow: true });
  assert.deepEqual(a2, { slot: 'pm', at: '18:00', inMin: 22 * 60, tomorrow: true });
});

test('다음 브리핑: 알림 시각이 이번 분이면 0분, 자정을 넘기는 알림도 센다', () => {
  assert.equal(upcomingBriefings('07:30', '18:00', kst(7, 30, 10))[0].inMin, 0);
  const [next] = upcomingBriefings('00:10', '18:00', kst(23, 50));
  assert.deepEqual(next, { slot: 'am', at: '00:10', inMin: 20, tomorrow: true });
});

test('남은 시간 글: 분·시간·곧', () => {
  assert.equal(remainingText(50), '50분 뒤에 와요');
  assert.equal(remainingText(60), '1시간 뒤에 와요');
  assert.equal(remainingText(75), '1시간 15분 뒤에 와요');
  assert.equal(remainingText(0), '곧 와요');
  assert.equal(clockText('07:30'), '7:30');
  assert.equal(clockText('18:00'), '18:00');
  assert.equal(minuteText(6 * 60 + 40), '6:40');
  assert.equal(minuteText(9), '0:09');
});

test('이번 주 일정: 날짜를 읽은 앞으로의 것만 날짜 순으로 둘, 관심사는 근거 소식이 닿은 것', () => {
  const schedule = {
    start: '2026-11-16', // 월요일, 다음 주는 11/23~
    next: [
      { text: '27일 기준금리 결정', ids: [2] },
      { text: '한국은행 금통위', ids: [9] }, // 날짜 없음
      { text: '26일 엔비디아 실적 발표', ids: [1] },
      { text: '19일 미국 물가 발표', ids: [3] }, // 지났다
      { text: '30일 11월 수출 발표', ids: [4] },
    ],
    personal: [
      { about: '국내 주식', ids: [1] },
      { about: '반도체', ids: [], tally: { plus: [1], minus: [], watch: [] } },
      { about: '대출 이자', ids: [2] },
    ],
  };
  const events = eventsOf(schedule, '2026-11-26');
  assert.deepEqual(events, [
    { month: 11, day: 26, weekday: '목', title: '엔비디아 실적 발표', about: ['국내 주식', '반도체'] },
    { month: 11, day: 27, weekday: '금', title: '기준금리 결정', about: ['대출 이자'] },
  ]);
  // 오늘이 지나면 오늘 일정은 빠진다
  assert.equal(eventsOf(schedule, '2026-11-27')[0]!.day, 27);
  // 읽을 수 있는 앞으로의 일정이 없으면 빈 목록
  assert.deepEqual(eventsOf({ start: '2026-11-16', next: [{ text: '한국은행 기준금리 결정' }], personal: [] }, '2026-11-26'), []);
});
