import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contextFactItems } from '@maengo/core/context';
import { basisLabel, factBases, findLinks, fixClaims, politicsToMarket, recentBases, sectionBases, trimVague, whenOf } from '../insight-rules';

// 2026-11-13 맞춤 인사이트 품질 검토에서 운영에 실제로 나간 문장들로 시험한다

const at = (v: string) => ({ value: v, updatedAt: '2026-11-13T00:00:00Z' });

test('때: 브리핑 날짜에서 본 오늘 아침·오늘·어제·그제·n일 전(한국 시각)', () => {
  assert.deepEqual(whenOf('2026-11-12T23:18:00Z', '2026-11-13'), { when: '오늘 아침', days: 0 }); // 11-13 08:18
  assert.deepEqual(whenOf('2026-11-13T06:40:00Z', '2026-11-13'), { when: '오늘', days: 0 }); // 15:40
  assert.deepEqual(whenOf('2026-11-11T05:56:00Z', '2026-11-13'), { when: '그제', days: 2 });
  assert.deepEqual(whenOf('2026-11-12T14:00:00Z', '2026-11-13'), { when: '어제', days: 1 }); // 11-12 23:00
  assert.deepEqual(whenOf('2026-11-08T10:12:00Z', '2026-11-13'), { when: '5일 전', days: 5 });
});

test('최근 소식 꼬리표: 때와 한 일을 서버가, 대상 이름만 AI가', () => {
  const [b] = recentBases([{ clusterId: 24347, title: '엔비디아 이사회, 젠슨 황 CEO 해임 논의', at: '2026-11-12T23:18:00Z', listened: true, read: true, starred: false }], '2026-11-13');
  assert.equal(b!.line, '(오늘 아침, 끝까지 들음·열어 봄) 엔비디아 이사회, 젠슨 황 CEO 해임 논의');
  assert.equal(basisLabel(b!, '엔비디아'), '오늘 아침 들은 엔비디아 소식');
  assert.equal(basisLabel(b!, '엔비디아 소식'), '오늘 아침 들은 엔비디아 소식');
  assert.equal(basisLabel(b!, ''), '오늘 아침 들은 소식');
  const [s] = recentBases([{ clusterId: 20625, title: '코스피 5,000선 붕괴', at: '2026-11-08T10:12:00Z', listened: true, read: false, starred: true }], '2026-11-13');
  assert.equal(basisLabel(s!, '코스피'), '5일 전 북마크한 코스피 소식');
});

test('분야 꼬리표: 본 게 적으면 자주 보는이 아니라 고른 분야', () => {
  assert.equal(sectionBases(['정치'], false)[0]!.label, '고른 정치 분야');
  assert.equal(sectionBases(['경제'], true)[0]!.label, '자주 보는 경제');
});

test('사정: 신경 쓰는 것·일이 먼저, 안 해요는 참고로, 분야를 통째로 고른 관심은 뺀다', () => {
  const ctx = {
    int_economy: at('kr_stock,us_stock,fx_rate,crypto,deposit,dividend,tax'), // 카드 한 번 = 통째
    int_real_estate: at('rebuild'), // 설정에서 하나만 고름
    focus: at('loan,house_price'),
    stock: at('no'),
    loan: at('fixed'),
    job: at('maker'),
    carrier: at('skt'),
  };
  const { bases, notes } = factBases(contextFactItems(ctx));
  assert.deepEqual(
    bases.map((b) => b.label),
    ['신경 쓰는 대출 이자', '신경 쓰는 집값', '제조 일', '고정금리 대출', '관심 있는 재건축·재개발', 'SKT'],
  );
  assert.equal(bases[0]!.id, 'F1');
  assert.deepEqual(notes, ['주식은 안 해요']);
});

test('막연한 끝맺음 잘라 내기(검토에서 27개 중 25개)', () => {
  assert.equal(
    trimVague('엔비디아 젠슨 황 CEO 사임으로 기술주 전반에 경영진 리스크가 퍼졌어요. 미국 주식을 하고 있다면, 보유한 빅테크 기업의 경영 안정성이나 관련 산업의 변동성을 면밀히 살펴보세요.'),
    '엔비디아 젠슨 황 CEO 사임으로 기술주 전반에 경영진 리스크가 퍼졌어요.',
  );
  assert.equal(trimVague('은행지주 CEO 연임 요건이 강화되면 은행의 경영 안정성에도 변화가 생겨요. 관심 있는 금융주나 예금 환경에 어떤 영향을 줄지 지켜보세요.'), '은행지주 CEO 연임 요건이 강화되면 은행의 경영 안정성에도 변화가 생겨요.');
  assert.equal(trimVague('앤스로픽의 자금 조달이 AI 데이터센터 인프라 투자의 지속성으로 어떻게 이어질지 확인해 보세요.'), '');
  assert.equal(trimVague('지난번 야권의 정부 책임론 제기 소식을 본 적 있죠. 정치권에서 어떤 대응책이 나오는지 관심을 두고 지켜보세요.'), '지난번 야권의 정부 책임론 제기 소식을 본 적 있죠.');
  // 구체적인 확인거리는 남긴다
  const concrete = '주택담보대출 금리가 오르면 매달 이자가 늘어요. 은행별 금리 공지를 확인해 보세요.';
  assert.equal(trimVague(concrete), concrete);
  assert.equal(trimVague('KB캐피탈 이용자라면 홈페이지 보안 공지를 확인해 보세요.'), 'KB캐피탈 이용자라면 홈페이지 보안 공지를 확인해 보세요.');
  // 숫자 속 마침표에서 자르지 않는다
  assert.equal(trimVague('코스피가 5342.73으로 0.6% 내렸어요.'), '코스피가 5342.73으로 0.6% 내렸어요.');
});

test('정치 소식을 증시로 잇는 말은 요약에 증시 얘기가 있을 때만', () => {
  assert.equal(politicsToMarket('politics', '이재명 대통령 국정 지지율 39%…부정 평가 50%', '정치적 불확실성이 커지면 국내 증시의 투자 심리가 더욱 위축될 수 있어요.'), true);
  assert.equal(politicsToMarket('politics', '이재명 대통령, 국내 증시 저평가 강조하며 자본시장 개혁 예고', '주주 환원 확대가 국내 주식에 닿아요.'), false);
  assert.equal(politicsToMarket('finance', '코스피 하락', '증시가 흔들려요.'), false);
});

test('근거에 없는 때·분야 말 바로잡기', () => {
  assert.equal(fixClaims('지난주 들은 엔비디아 관련 소식이 결국 CEO 사임으로 이어졌어요.', { seen: true, oldest: 0 }), '들은 엔비디아 관련 소식이 결국 CEO 사임으로 이어졌어요.');
  assert.equal(fixClaims('지난주 들은 소식이에요.', { seen: true, oldest: 6 }), '지난주 들은 소식이에요.');
  assert.equal(fixClaims('부동산 분야를 자주 보는 만큼', { seen: false, oldest: 0 }), '부동산 분야를 고른 만큼');
});

test('이어지는 이야기: 묶음 중심 벡터 코사인 0.72부터', () => {
  const v = (deg: number) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const links = findLinks(
    [
      { id: 1, vec: v(0) },
      { id: 2, vec: v(80) },
      { id: 3, vec: null },
    ],
    [
      { basisId: 'R1', vec: v(30) }, // 1과 cos 0.87, 2와 0.64
      { basisId: 'R2', vec: v(50) }, // 1과 cos 0.64, 2와 0.87
    ],
  );
  assert.deepEqual([...links], [[1, ['R1']], [2, ['R2']]]);
});

test('글 속 ○○ 들은/읽은은 근거의 때·한 일대로, 가졌다고 알려 주지 않았으면 보유한을 뺀다', async () => {
  const { alignReadClaim, dropOwnership } = await import('../insight-rules');
  const [today] = recentBases([{ clusterId: 1, title: '엔비디아 해임 논의', at: '2026-11-13T06:40:00Z', listened: true, read: false, starred: false }], '2026-11-13');
  assert.equal(alignReadClaim('어제 들은 엔비디아의 다음 장', today), '오늘 들은 엔비디아의 다음 장');
  const [old] = recentBases([{ clusterId: 2, title: '코스피 5,000선 붕괴', at: '2026-11-07T12:33:00Z', listened: false, read: true, starred: false }], '2026-11-13');
  assert.equal(alignReadClaim('6일 전 들은 코스피 하락 소식이 더 깊어지고 있어요.', old), '6일 전 읽은 코스피 하락 소식이 더 깊어지고 있어요.');
  const keyword = { id: 'K1', kind: 'keyword' as const, label: '내 키워드 세금·정책', line: '' };
  assert.equal(dropOwnership('보유한 부동산의 세 부담이 달라질 수 있어요.', keyword), '부동산의 세 부담이 달라질 수 있어요.');
  const owns = { id: 'F1', kind: 'fact' as const, label: '1주택', line: '집이 한 채 있어요' };
  assert.equal(dropOwnership('보유한 집의 세 부담이 달라질 수 있어요.', owns), '보유한 집의 세 부담이 달라질 수 있어요.');
});

test("화면 글에 '돈 쪽'은 '경제 쪽'으로", async () => {
  const { plainWords } = await import('../insight-rules');
  assert.equal(plainWords('엔비디아 CEO 사임 여파와 시장의 흐름, 오늘 돈 쪽 소식'), '엔비디아 CEO 사임 여파와 시장의 흐름, 오늘 경제 쪽 소식');
});

test('AI 카드를 예전에(로봇 없이 5개) 누른 회원도 통째로 고른 관심으로 본다', () => {
  const old = factBases(contextFactItems({ int_ai: at('model,invest,service,work,rules') }));
  assert.equal(old.bases.length, 0);
  const picked = factBases(contextFactItems({ int_ai: at('robot') }));
  assert.deepEqual(picked.bases.map((b) => b.label), ['관심 있는 로봇']);
});

test('신경 쓰는 경제 부문은 많이 골라도 하나하나가 근거(카드처럼 통째로 버리지 않는다)', () => {
  const { bases } = factBases(contextFactItems({ focus: at('kr_stock,us_stock,crypto,fx,deposit,loan,home,house_price') }));
  assert.equal(bases.length, 8);
  assert.equal(bases[0]!.line, '요즘 국내 주식을 신경 써요');
});

test('내 계정 오늘 퇴근길(11-13)에서 본 것: 확인한도 근거대로, 지켜볼 필요가 있어요도 자른다', async () => {
  const { alignReadClaim } = await import('../insight-rules');
  const [b] = recentBases([{ clusterId: 1, title: '앤트로픽 IPO 로드쇼 시작', at: '2026-11-11T00:34:00Z', listened: true, read: false, starred: false }], '2026-11-13');
  assert.equal(alignReadClaim('3일 전 확인한 앤스로픽 IPO 추진이 흥행으로 이어졌어요.', b), '그제 들은 앤스로픽 IPO 추진이 흥행으로 이어졌어요.');
  assert.equal(trimVague('사임으로 이어지며 주가가 14% 폭락 후 내림세로 마감했어요. 새로운 경영진이 핵심 사업을 안정적으로 이끌지 지켜볼 필요가 있어요.'), '사임으로 이어지며 주가가 14% 폭락 후 내림세로 마감했어요.');
});
