import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanDigest, digestPrompt, dueReports, lastCompleted, periodEnd, periodStart, pickDigestItems, prevStart, reportPushTitle, reportRange, reportTitle,
  weekStart, type DigestItem,
} from '../report';

test('리포트 기간: 주는 월~일', () => {
  assert.equal(weekStart('2026-11-10'), '2026-11-09'); // 화 → 월
  assert.equal(weekStart('2026-11-09'), '2026-11-09'); // 월
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // 일 → 그 주 월
  assert.equal(periodEnd('week', '2026-11-09'), '2026-11-15');
  assert.equal(prevStart('week', '2026-11-09'), '2026-11-02');
  assert.equal(periodStart('week', '2026-11-27'), '2026-11-23');
});

test('오늘 만들 리포트: 다 끝난 지난주만(월간은 없다)', () => {
  assert.deepEqual(dueReports('2026-11-10'), [{ period: 'week', start: '2026-11-02' }]);
  // 월요일 당일도 지난주(오늘이 든 주는 아직 안 끝났다)
  assert.deepEqual(dueReports('2026-11-16'), [{ period: 'week', start: '2026-11-09' }]);
  // 달이 바뀌어도 주간 하나
  assert.deepEqual(dueReports('2026-12-01'), [{ period: 'week', start: '2026-11-23' }]);
  assert.equal(lastCompleted('week', '2026-01-03'), '2025-12-22');
});

test('리포트 이름: 그 주 월요일이 그 달 몇 번째 월요일인지', () => {
  assert.equal(reportTitle('week', '2026-11-02'), '11월 첫째 주');
  assert.equal(reportTitle('week', '2026-11-09'), '11월 둘째 주');
  assert.equal(reportTitle('week', '2026-11-30'), '11월 다섯째 주');
  assert.equal(reportTitle('week', '2025-12-29', '2026-01-02'), '2025년 12월 다섯째 주');
  assert.equal(reportRange('week', '2026-11-02'), '11.2 ~ 11.8');
  assert.equal(reportPushTitle('week', '2026-11-02'), '지난주 리포트가 나왔어요');
});

const item = (id: number, group: string, extra: Partial<DigestItem> = {}): DigestItem => ({
  id,
  group,
  title: `제목 ${id}`,
  short: `요약 ${id}`,
  consumed: false,
  impact: 'routine',
  ...extra,
});

test('정리에 넘길 소식: 읽은 것·큰 소식부터 상한까지, 넘길 때는 분야 순서로', () => {
  const items = [item(1, '주식'), item(2, 'AI', { consumed: true }), item(3, 'AI', { impact: 'major' }), item(4, 'AI'), item(5, '주식', { consumed: true })];
  const picked = pickDigestItems(items, ['AI', '주식'], 3);
  assert.deepEqual(
    picked.map((i) => i.id),
    [2, 3, 5],
  );
  const prompt = digestPrompt('11월 첫째 주 (11.2 ~ 11.8)', ['AI', '주식'], picked, 3);
  assert.match(prompt, /\[분야\] AI, 주식/);
  assert.match(prompt, /## AI\n\[2\] ✓ 제목 2 — 요약\n\[3\] 제목 3/);
  assert.match(prompt, /\[회원이 알려 준 사정\] 없음/);
  assert.match(digestPrompt('주', ['AI'], picked, 3, ['국내 주식을 해요', '자가용으로 출퇴근해요']), /\[회원이 알려 준 사정\] 국내 주식을 해요, 자가용으로 출퇴근해요/);
});

test('정리 다듬기: 모르는 분야·번호는 버리고, 분야 이름과 같은 키워드는 뺀다', () => {
  const raw = {
    headline: '  엔비디아 실적과 HBM 경쟁이  한 주를 이끌었어요 ',
    sections: [
      { group: 'AI', summary: '오픈AI와 구글이 새 모델을 나란히 내놓았어요. 코딩 에이전트 경쟁도 이어졌어요.', ids: [1, 2, 99] },
      { group: 'AI', summary: '같은 분야 두 번째는 버린다. 길이는 충분하게 적어 둔다.', ids: [1] },
      { group: '없는 분야', summary: '모르는 분야는 버린다. 길이는 충분하게 적어 둔다.', ids: [3] },
      { group: '반도체 · 로봇', summary: '삼성과 SK하이닉스가 HBM4 공급을 두고 경쟁했어요.', ids: [99] },
    ],
    keywords: [
      { word: 'HBM4', ids: [3] },
      { word: 'ai', ids: [1] },
      { word: 'hbm4', ids: [2] },
      { word: '엔비디아', ids: [] },
    ],
  };
  const d = cleanDigest(raw, ['AI', '반도체·로봇'], [1, 2, 3]);
  assert.ok(d);
  assert.equal(d.headline, '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요');
  assert.deepEqual(d.sections, [{ group: 'AI', summary: '오픈AI와 구글이 새 모델을 나란히 내놓았어요. 코딩 에이전트 경쟁도 이어졌어요.', ids: [1, 2] }]);
  assert.deepEqual(d.keywords, [{ word: 'HBM4', ids: [3] }]);
  // 분야 정리가 하나도 안 남거나 총평이 없으면 실패
  assert.equal(cleanDigest({ ...raw, sections: [] }, ['AI'], [1]), null);
  assert.equal(cleanDigest({ ...raw, headline: '' }, ['AI'], [1, 2]), null);
  assert.equal(cleanDigest('x', ['AI'], [1]), null);
});

test('맞춤 체크·다음 주 지켜볼 것: 사정을 알려 준 회원만, 투자 권유와 모르는 번호는 버린다', () => {
  const base = {
    headline: '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요',
    sections: [{ group: 'AI', summary: '오픈AI와 구글이 새 모델을 나란히 내놓았어요. 코딩 에이전트 경쟁도 이어졌어요.', ids: [1] }],
    keywords: [],
    personal: [
      { about: '국내 주식', title: '반도체 변동성이 커졌어요', text: '삼성전자와 SK하이닉스가 크게 흔들려 국내 증시 전체에 부담이 됐어요. 다음 주 실적 발표 일정을 확인해 보세요.', ids: [2, 99] },
      { about: '국내 주식', title: '비중을 줄일 때', text: '반도체 비중을 줄이고 다른 업종으로 분산 투자해 보세요. 이건 권유라서 버린다.', ids: [2] },
      { about: '자가용 출퇴근', title: '기름값이 오를 수 있어요', text: '국제 유가가 오르면 다음 달 주유비가 늘 수 있어요.', ids: [99] },
    ],
    next: [
      { text: '19일 미국 물가 발표', ids: [1] },
      { text: '19일 미국 물가 발표', ids: [2] },
      { text: '삼성전자 주식을 매수할 시점', ids: [2] },
      { text: '한국은행 기준금리 결정', ids: [] },
    ],
  };
  const d = cleanDigest(base, ['AI'], [1, 2], true);
  assert.ok(d);
  assert.deepEqual(d.personal, [
    { about: '국내 주식', title: '반도체 변동성이 커졌어요', text: '삼성전자와 SK하이닉스가 크게 흔들려 국내 증시 전체에 부담이 됐어요. 다음 주 실적 발표 일정을 확인해 보세요.', ids: [2] },
  ]);
  assert.deepEqual(d.next, [{ text: '19일 미국 물가 발표', ids: [1] }]);
  // 사정이 없으면 맞춤 체크는 비운다(지어낸 것)
  assert.deepEqual(cleanDigest(base, ['AI'], [1, 2])!.personal, []);
});
