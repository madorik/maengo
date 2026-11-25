import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatChange, formatMarket, marketChange, marketPromptLine, parseEcos, weekPoints, type ReportMarket } from '../markets';

test('ECOS 응답 읽기: 날짜·값만, 숫자가 아니면 버리고 날짜 순으로', () => {
  const json = {
    StatisticSearch: {
      list_total_count: 3,
      row: [
        { TIME: '20261117', DATA_VALUE: '4968.48' },
        { TIME: '20261116', DATA_VALUE: '5100.5' },
        { TIME: '2026111', DATA_VALUE: '1' },
        { TIME: '20261118', DATA_VALUE: '-' },
      ],
    },
  };
  assert.deepEqual(parseEcos(json), [{ date: '2026-11-16', value: 5100.5 }, { date: '2026-11-17', value: 4968.48 }]);
  assert.deepEqual(parseEcos({ RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } }), []);
  assert.deepEqual(parseEcos(null), []);
});

const kospi: ReportMarket = {
  key: 'kospi', name: '코스피', unit: '',
  points: [
    { date: '2026-11-13', value: 5290.53 },
    { date: '2026-11-16', value: 5100.5 },
    { date: '2026-11-17', value: 4968.48 },
    { date: '2026-11-20', value: 4869.96 },
    { date: '2026-11-23', value: 4708.54 },
  ],
};

test('한 주 등락: 앞 주 마지막 거래일 → 그 주 마지막 거래일', () => {
  assert.deepEqual(weekPoints(kospi, '2026-11-16').map((p) => p.date), ['2026-11-16', '2026-11-17', '2026-11-20']);
  const c = marketChange(kospi, '2026-11-16')!;
  assert.equal(c.from, 5290.53);
  assert.equal(c.to, 4869.96);
  assert.equal(formatChange('kospi', c).text, '▼ 7.9%');
  assert.equal(marketPromptLine(kospi, '2026-11-16'), '- kospi 코스피: 5,290.53 → 4,869.96 (▼ 7.9%)');
  // 앞 주 값이 없으면 그 주 첫 거래일과 견준다, 그 주 값이 없으면 null
  assert.equal(marketChange({ ...kospi, points: kospi.points.slice(1) }, '2026-11-16')!.from, 5100.5);
  assert.equal(marketChange(kospi, '2026-11-30'), null);
});

test('값·등락 글: 환율은 원, 금리는 %p, 바뀐 게 없으면 보합', () => {
  assert.equal(formatMarket('usdkrw', 1402.3), '1,402.3원');
  assert.equal(formatMarket('ktb3y', 3.05), '3.05%');
  assert.deepEqual(formatChange('ktb3y', { from: 2.97, to: 3.05, diff: 0.08, pct: 2.7 }), { arrow: '▲', text: '▲ 0.08%p', spoken: '0.08%p 올랐어요' });
  assert.equal(formatChange('usdkrw', { from: 1400, to: 1400.2, diff: 0.2, pct: 0.014 }).text, '보합');
});
