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

// ---- 알림 문구·Free 요약·요일별 차트(2026-11-19) ----
import { busiestDay, dayName, PEEK_CHARS, peekCut, PUSH_BODY_MAX, reportPreview, reportPushBody, weekDates, type ReportData } from '../report';

const data = (over: Partial<ReportData> = {}, digest: Partial<ReportData['digest']> = {}): ReportData => ({
  v: 1,
  counts: { received: 20, consumed: 9, listened: 4, bookmarked: 1 },
  prev: { received: 18, consumed: 7, listened: 2, bookmarked: 0 },
  groups: [{ id: 'stock', name: '주식', received: 12, consumed: 6, prevConsumed: 4 }],
  added: [],
  digest: {
    headline: '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요',
    sections: [{ group: '주식', summary: '삼성전자와 SK하이닉스가 HBM 공급 경쟁 소식에 크게 오르내렸고 코스피도 출렁였어요.', ids: [1] }],
    keywords: [{ word: 'HBM4', ids: [1] }],
    personal: [],
    next: [],
    ...digest,
  },
  missed: [],
  items: { '1': { title: '삼성전자 HBM4 공급 확정', category: 'etc' } },
  ...over,
});

test('알림 문구: 맞춤 체크가 있으면 그 사정과 첫 문장', () => {
  const d = data({}, { personal: [{ about: '국내 주식', title: '반도체가 흔든 한 주', text: 'AI 투자 위축 우려로 삼성전자·SK하이닉스가 크게 떨어졌어요. 다음 주 미국 물가 발표가 분위기를 가를 수 있어요.', ids: [1] }] });
  assert.equal(reportPushBody(d), '국내 주식 · AI 투자 위축 우려로 삼성전자·SK하이닉스가 크게 떨어졌어요.');
});

test('알림 문구: 맞춤 체크가 없으면 놓친 주요 소식(맞춤 인사이트를 켠 사람만), 아니면 총평', () => {
  const missed = { missed: [1], personalized: true };
  assert.equal(reportPushBody(data(missed)), '놓친 주요 소식 1개 · 삼성전자 HBM4 공급 확정');
  // 끈 사람(또는 이 칸이 생기기 전 리포트)에게는 읽은 기록으로 만든 말을 쓰지 않는다
  assert.equal(reportPushBody(data({ missed: [1], personalized: false })), '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요');
  assert.equal(reportPushBody(data({ missed: [1] })), '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요');
  // 제목을 모르는 소식은 세지 않는다
  assert.equal(reportPushBody(data({ missed: [99], personalized: true })), '엔비디아 실적과 HBM 경쟁이 한 주를 이끌었어요');
});

test('알림 문구: 너무 길면 줄임표로 자른다', () => {
  const d = data({}, { personal: [{ about: '국내 주식', title: '긴 제목이에요', text: `${'가'.repeat(120)}.`, ids: [1] }] });
  const body = reportPushBody(d);
  assert.equal(body.length, PUSH_BODY_MAX);
  assert.ok(body.endsWith('…'));
});

test('Free 요약: 총평·숫자와 첫 칸의 앞부분만, 나머지는 이름과 개수만 내려보낸다', () => {
  const text = `반도체 변동성이 커진 한 주였어요. 다음 주 미국 물가 발표와 삼성전자 실적 발표 일정을 확인해 보세요. ${'가'.repeat(60)} 비밀스러운 끝부분이에요.`;
  const full = data(
    { days: weekDates('2026-11-09').map((date) => ({ date, received: 3, consumed: 1 })), missed: [1] },
    { personal: [{ about: '국내 주식', title: '반도체가 흔든 한 주', text, ids: [1] }, { about: '대출', title: '이자 부담', text: '둘째 맞춤 체크의 본문이에요. 이것은 새면 안 돼요.', ids: [1] }], next: [{ text: '19일 미국 물가 발표', ids: [1] }] },
  );
  const p = reportPreview(full);
  assert.equal(p.headline, full.digest.headline);
  assert.deepEqual(p.counts, full.counts);
  assert.equal(p.peek?.label, '맞춤 체크');
  assert.equal(p.peek?.about, '국내 주식');
  assert.ok((p.peek?.text.length ?? 0) <= PEEK_CHARS);
  assert.ok((p.peek?.text.length ?? 0) >= 90); // 3줄 안팎은 보인다(2026-11-21 사용자: 한 줄만이 아니라 3~4줄)
  assert.ok(p.peek?.text.endsWith('…'));
  // 화면(Premium) 순서대로. 2026-11-26 개편으로 분야별 정리·많이 본 분야 차트는 화면에서 빠져 잠금 목록에도 없다
  assert.deepEqual(p.locked, [
    { label: '맞춤 체크', count: 2 },
    { label: '이번 주 챙겨 볼 일정', count: 1 },
    { label: '놓친 주요 소식', count: 1 },
    { label: '요일별로 본 흐름 차트', count: null },
    { label: '자주 나온 키워드', count: 1 },
  ]);
  // 내려보내는 값 어디에도 뒷부분·둘째 맞춤 체크·다음 주 지켜볼 것 본문·키워드 말은 없다
  const sent = JSON.stringify(p);
  for (const secret of ['비밀스러운 끝부분', '둘째 맞춤 체크', '19일 미국 물가', 'HBM4', '삼성전자 HBM4 공급 확정']) assert.ok(!sent.includes(secret), secret);
});

test('Free 요약: 맞춤 체크가 없으면 첫 분야 정리의 앞부분', () => {
  const p = reportPreview(data());
  assert.equal(p.peek?.label, '분야별로 보면');
  assert.equal(p.peek?.about, '주식');
  assert.ok((p.peek?.text.length ?? 0) <= PEEK_CHARS);
  // 이 칸이 생기기 전 리포트(days 없음)에는 차트 줄을 쓰지 않는다
  assert.ok(!p.locked.some((l) => l.label === '요일별로 본 흐름 차트'));
});

test('Free 요약: 첫 분야 정리가 두 문장이면 첫 문장을 제목으로, 둘째 문장을 앞부분만', () => {
  const summary = '삼성전자가 HBM4 공급을 따내며 반도체주가 일제히 올랐어요. 다음 주 엔비디아 실적 발표에서 물량 전망이 나오면 코스피 흐름이 한 번 더 갈릴 수 있어요.';
  const p = reportPreview(data({}, { sections: [{ group: '주식', summary, ids: [1] }] }));
  assert.equal(p.peek?.title, '삼성전자가 HBM4 공급을 따내며 반도체주가 일제히 올랐어요.');
  assert.equal(p.peek?.about, '주식');
  assert.ok(p.peek?.text.endsWith('…'));
  assert.ok(!JSON.stringify(p).includes('코스피 흐름이 한 번 더 갈릴'));
});

test('맛보기 자르기: 길면 PEEK_CHARS 안에서 낱말 끝으로, 짧아도 뒤 20%는 가린다', () => {
  const long = '삼성전자와 SK하이닉스가 AI 투자 위축 우려로 일주일 새 크게 떨어지며 코스피가 출렁였어요. 다음 주 미국 물가 발표가 이 분위기를 되돌릴지 가를 수 있어요.';
  const a = peekCut(long, PEEK_CHARS);
  assert.ok(a.length <= PEEK_CHARS && a.endsWith('…'));
  assert.ok(long.startsWith(a.slice(0, -1))); // 앞부분 그대로
  assert.ok(!/ …$/.test(a)); // 줄임표 앞에 빈칸·쉼표가 없다
  assert.ok(a.length >= 60); // 3줄 안팎은 보인다

  const short = '반도체주가 올랐어요. 다음 주 실적 발표를 확인해 보세요.';
  const b = peekCut(short, PEEK_CHARS);
  assert.ok(b.endsWith('…'));
  assert.ok(b.length - 1 <= Math.floor(short.length * 0.8)); // 끝까지 보여 주지 않는다
  assert.ok(short.startsWith(b.slice(0, -1)));

  // 낱말 경계가 없는 글도 max를 넘지 않는다
  assert.ok(peekCut('가'.repeat(300), PEEK_CHARS).length <= PEEK_CHARS);
});

test('요일별 차트: 요일 이름과 한 주 7일, 가장 많이 본 날', () => {
  assert.equal(dayName('2026-11-09'), '월');
  assert.equal(dayName('2026-11-15'), '일');
  assert.deepEqual(weekDates('2026-11-09'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  const days = weekDates('2026-11-09').map((date, i) => ({ date, received: 4, consumed: [0, 2, 5, 5, 1, 0, 0][i]! }));
  assert.equal(busiestDay(days)?.date, '2026-11-11'); // 5개가 둘이면 앞선 날
  assert.equal(busiestDay(days.map((d) => ({ ...d, consumed: 0 }))), null);
});

// ---- 내 관심사에 준 영향·지난주 경제(2026-11-25) ----
import { REPORT_TONES, toneTotals } from '../report';

test('내 관심사에 준 영향: 쪽이 있으면 쪽별 소식·지표·다음 주를 붙이고, 한 소식은 한 쪽에만', () => {
  const base = {
    headline: '외국인 자금이 빠져 국내 주식엔 부담, 반도체엔 기회가 많았어요',
    sections: [{ group: 'AI', summary: '오픈AI와 구글이 새 모델을 나란히 내놓았어요. 코딩 에이전트 경쟁도 이어졌어요.', ids: [1] }],
    keywords: [],
    personal: [
      {
        about: '국내 주식', title: '외국인이 닷새 내내 팔았어요', text: '외국인 자금이 반도체 대형주에서 닷새 동안 빠져나가며 코스피가 크게 내렸어요. 다음 주 실적 발표 일정을 확인해 보세요.',
        ids: [2], tone: 'minus', minus: [2, 3, 99], plus: [3, 4], watch: [5], metric: 'kospi', next: '26일 엔비디아 실적 발표',
      },
      // 흐름을 바꾼 소식(ids)이 어느 쪽에도 없으면 그 관심사의 쪽에 넣는다. 받지 않은 지표는 버린다
      { about: '대출 이자', title: '주담대 금리 상단이 올라', text: '은행채 금리가 오르며 주담대 금리 상단이 다시 올랐어요. 변동금리라면 다음 달 이자를 확인해 보세요.', ids: [4], tone: 'minus', minus: [], plus: [], watch: [], metric: 'ktb3y', next: '' },
      // 쪽이 없는 예전 모양은 그대로
      { about: '반도체', title: 'HBM 경쟁이 주가로', text: '읽어 온 HBM 공급 경쟁이 이번 주 반도체주 흐름으로 이어졌어요. 다음 주 실적 발표를 확인해 보세요.', ids: [1] },
      { about: '잘못된 쪽', title: '쪽 이름이 틀렸어요', text: '쪽 이름이 정해진 셋이 아니면 쪽 없이 둔다. 길이는 충분하게 적어 둔다.', ids: [1], tone: 'good' },
    ],
    next: [],
    economy: { headline: '외국인 자금이 빠지고 달러가 강해진 한 주였어요', notes: [{ key: 'kospi', text: '외국인이 반도체 대형주를 닷새 내내 팔았어요.' }, { key: 'kospi', text: '같은 지표 두 번째는 버린다. 길이는 충분하게.' }, { key: 'gold', text: '받지 않은 지표의 설명은 버린다. 길이는 충분하게.' }] },
  };
  const d = cleanDigest(base, ['AI'], [1, 2, 3, 4, 5], true, ['kospi', 'usdkrw']);
  assert.ok(d);
  assert.deepEqual(d.personal![0], {
    about: '국내 주식', title: '외국인이 닷새 내내 팔았어요', text: base.personal[0]!.text, ids: [2],
    tone: 'minus', tally: { minus: [2, 3], plus: [4], watch: [5] }, metric: 'kospi', next: '26일 엔비디아 실적 발표',
  });
  assert.deepEqual(d.personal![1]!.tally, { minus: [4], plus: [], watch: [] });
  assert.equal(d.personal![1]!.metric, undefined); // ktb3y는 받지 않았다
  assert.equal(d.personal![1]!.next, undefined);
  assert.deepEqual(Object.keys(d.personal![2]!), ['about', 'title', 'text', 'ids']);
  assert.equal(d.personal![3]!.tone, undefined);
  assert.deepEqual(d.economy, { headline: base.economy.headline, notes: [{ key: 'kospi', text: '외국인이 반도체 대형주를 닷새 내내 팔았어요.' }] });
  // 지표를 받지 않았으면 경제 칸은 없다
  assert.equal(cleanDigest(base, ['AI'], [1, 2, 3, 4, 5], true)!.economy, undefined);
  // 관심사들에 닿은 소식을 쪽마다(같은 소식은 앞선 관심사의 쪽으로 한 번)
  assert.deepEqual(toneTotals(d.personal), { plus: 1, minus: 2, watch: 1 }); // 4는 앞 관심사에서 긍정으로 셌다
  assert.equal(toneTotals([{ about: 'a', title: 'b', text: 'c', ids: [1] }]), null);
  assert.deepEqual(REPORT_TONES, ['minus', 'plus', 'watch']);
});

test('프롬프트: 시장 지표가 있으면 [시장] 줄, 없으면 없음', () => {
  const items: DigestItem[] = [{ id: 1, group: 'AI', title: '제목', short: '요약', consumed: false, impact: null }];
  assert.match(digestPrompt('주', ['AI'], items, 3), /\[시장\] 없음/);
  const p = digestPrompt('주', ['AI'], items, 3, [], ['- kospi 코스피: 5,290.53 → 4,869.96 (▼ 7.9%)']);
  assert.match(p, /\[시장\] 앞 주 마지막 거래일 → 이 기간 마지막 거래일\n- kospi 코스피: 5,290.53 → 4,869.96 \(▼ 7\.9%\)\n\[소식\]/);
});

test('Free 요약: 쪽을 나눈 리포트는 칸 이름이 관심사별로 자세히, 쪽별 수와 시장 칸 이름', () => {
  const personal = [{ about: '국내 주식', title: '외국인이 팔았어요', text: '외국인 자금이 닷새 동안 빠져나가며 코스피가 내렸어요. 다음 주 실적 발표를 확인해 보세요.', ids: [1], tone: 'minus' as const, tally: { minus: [1, 2], plus: [3], watch: [] } }];
  const p = reportPreview(data({ markets: [{ key: 'kospi', name: '코스피', unit: '', points: [] }] }, { personal }));
  assert.equal(p.peek?.label, '관심사별로 자세히');
  assert.deepEqual(p.tones, { minus: 2, plus: 1, watch: 0 });
  assert.deepEqual(p.locked.slice(0, 2), [{ label: '관심사별로 자세히', count: 1 }, { label: '지난주 시장', count: 1 }]);
  assert.equal(reportPreview(data()).tones, null);
});

test('챙겨 볼 일정: 글에서 날짜를 읽는다(달이 없으면 다음 주부터, 날짜가 아닌 말은 읽지 않는다)', async () => {
  const { scheduleDate } = await import('../report');
  const start = '2026-11-16'; // 월요일, 다음 주는 11/23~
  assert.deepEqual(scheduleDate('26일 엔비디아 실적 발표', start), { date: '2026-11-26', month: 11, day: 26, weekday: '목' });
  assert.deepEqual(scheduleDate('12월 1일 11월 수출 발표', start), { date: '2026-12-01', month: 12, day: 1, weekday: '화' });
  // 달이 없고 '1일'이면 다음 달 1일(다음 주부터 첫 번째 1일)
  assert.equal(scheduleDate('1일 수출 발표', start)?.date, '2026-12-01');
  assert.equal(scheduleDate('27~28일 한국은행 금통위', start)?.date, '2026-11-27');
  // 날짜가 아닌 '3일 연속'은 건너뛰고 뒤의 날짜를 읽는다
  assert.equal(scheduleDate('3일 연속 매도, 26일 실적 발표', start)?.date, '2026-11-26');
  assert.equal(scheduleDate('3일 연속 매도 여부', start), null);
  assert.equal(scheduleDate('한국은행 기준금리 결정', start), null);
  assert.equal(scheduleDate('11월 수출 발표', start), null);
  // 없는 날은 읽지 않고, 해를 넘긴 달은 다음 해로
  assert.equal(scheduleDate('2월 30일 발표', start), null);
  assert.equal(scheduleDate('1월 8일 미국 고용 발표', '2026-12-28')?.date, '2027-01-08');
});

test('챙겨 볼 일정: 날짜 칸이 있으면 제목에서 맨 앞 날짜를 뗀다', async () => {
  const { scheduleTask } = await import('../report');
  assert.equal(scheduleTask('26일 엔비디아 실적 발표', true), '엔비디아 실적 발표');
  assert.equal(scheduleTask('12월 1일 수출 발표', true), '수출 발표');
  assert.equal(scheduleTask('27~28일 목요일 한국은행 금통위', true), '한국은행 금통위');
  // 날짜를 못 읽은 글·떼면 비는 글은 그대로
  assert.equal(scheduleTask('한국은행 기준금리 결정', false), '한국은행 기준금리 결정');
  assert.equal(scheduleTask('26일 엔비디아 실적 발표', false), '26일 엔비디아 실적 발표');
  assert.equal(scheduleTask('26일', true), '26일');
});

test('투자 권유 거르기: 시장 참여자의 매매를 전하는 사실은 통과, 권유는 그대로 걸린다', async () => {
  const { isAdvice } = await import('../report');
  assert.equal(isAdvice('외국인·기관 매도와 AI 투자 불안에 국내 증시가 크게 밀렸어요'), false);
  assert.equal(isAdvice('외국인·기관의 동반 매도와 경계감에 코스닥도 7.7% 내렸어요.'), false);
  assert.equal(isAdvice('개인은 2조 원 순매수했어요'), false);
  assert.equal(isAdvice('삼성전자 주식을 매수할 시점이에요'), true);
  assert.equal(isAdvice('반도체 비중을 줄여 보세요'), true);
  assert.equal(isAdvice('외국인 매도가 이어지니 팔아 보세요'), true);
});

