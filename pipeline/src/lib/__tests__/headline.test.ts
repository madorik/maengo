import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NEWS_SECTIONS } from '@maengo/core/topics';
import { SOURCES } from '../../sources';
import { headlineOf, isRoutineTitle, outletOf, type HeadlineMember } from '../headline';

const ko = (url: string, section: HeadlineMember['section'] = null, title = '국감 2주차 여야 충돌'): HeadlineMember => ({ url, title, kind: 'article', lang: 'ko', section });

test('언론사: 기사 주소의 등록 도메인', () => {
  assert.equal(outletOf('https://news.sbs.co.kr/news/endPage.do?news_id=N1008791276'), 'sbs.co.kr');
  assert.equal(outletOf('https://www.donga.com/news/Politics/article/all/20261011/134818057/1'), 'donga.com');
  assert.equal(outletOf('https://www.yna.co.kr/view/AKR20261008146000001'), 'yna.co.kr');
  assert.equal(outletOf('https://zdnet.co.kr/view/?no=1'), 'zdnet.co.kr');
  assert.equal(outletOf('not a url'), null);
});

test('헤드라인: 국내 언론사 3곳 이상, 분야는 섹션 피드 기사 중 가장 많은 것', () => {
  const members = [
    ko('https://www.yna.co.kr/view/A', 'politics'),
    ko('https://www.donga.com/news/1', 'politics'),
    ko('https://www.khan.co.kr/article/1', 'society'),
  ];
  assert.deepEqual(headlineOf(members), { section: 'politics', outlets: 3 });
  // 두 곳뿐이면 아니다
  assert.equal(headlineOf(members.slice(0, 2)), null);
});

test('헤드라인: 같은 언론사의 다른 섹션 피드는 한 곳으로 센다', () => {
  const members = [
    ko('https://www.yna.co.kr/view/A', 'politics'),
    ko('https://www.yna.co.kr/view/B', 'society'),
    ko('https://www.donga.com/news/1', 'politics'),
  ];
  assert.equal(headlineOf(members), null);
});

test('헤드라인: 영상·해외 기사는 세지 않고, 섹션 피드 기사가 없으면 아니다', () => {
  const base = [ko('https://www.yna.co.kr/view/A', 'world'), ko('https://www.donga.com/news/1', 'world')];
  assert.equal(headlineOf([...base, { url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '영상', kind: 'video', lang: 'ko', section: null }]), null);
  assert.equal(headlineOf([...base, { url: 'https://www.cnbc.com/a', title: 'news', kind: 'article', lang: 'en', section: null }]), null);
  // 섹션 없는 국내 매체도 언론사 수에는 든다
  assert.deepEqual(headlineOf([...base, ko('https://www.hankyung.com/article/1')]), { section: 'world', outlets: 3 });
  // 블로그·전문지끼리만 겹친 소식은 헤드라인이 아니다
  assert.equal(headlineOf([ko('https://a.com/1'), ko('https://b.com/1'), ko('https://c.com/1')]), null);
});

test('정례 기사(날씨·로또·운세·사진)는 언론사 수에 넣지 않는다', () => {
  for (const t of ['[오늘의 날씨] 중부 맑고 건조, 일교차 커', '[날씨/XR] 일요일도 늦더위', '로또 1245회 당첨번호 ‘4·5·25·28·32·42’', '[오늘의 운세] 10월 11일 띠별 운세', '[포토] 고양 창릉천 걷기대회'])
    assert.ok(isRoutineTitle(t), t);
  for (const t of ['[속보] 이란, 호르무즈 유조선 기뢰 피격', '[단독] 중수청장 인선 갈등', '날씨 탓에 농산물값 급등']) assert.ok(!isRoutineTitle(t), t);
  const lotto = (url: string, section: HeadlineMember['section']) => ko(url, section, '로또 1245회 1등 당첨번호');
  assert.equal(headlineOf([lotto('https://www.yna.co.kr/view/A', 'society'), lotto('https://www.donga.com/news/1', 'society'), lotto('https://www.khan.co.kr/article/1', 'society')]), null);
});

test('헤드라인: 섹션 표가 같으면 NEWS_SECTIONS 순서(정치 → 경제 → …)', () => {
  const members = [ko('https://www.yna.co.kr/view/A', 'world'), ko('https://www.donga.com/news/1', 'politics'), ko('https://www.khan.co.kr/article/1')];
  assert.equal(headlineOf(members)?.section, 'politics');
});

test('출처의 section은 모두 뉴스 분야 id다', () => {
  const ids = new Set(NEWS_SECTIONS.map((t) => t.id));
  for (const s of SOURCES) if (s.section) assert.ok(ids.has(s.section), s.name);
  // 분야마다 국내 언론사가 3곳 이상 있어야 헤드라인을 고를 수 있다
  for (const id of ids) {
    const outlets = new Set(SOURCES.filter((s) => s.section === id).map((s) => s.name.split(' ')[0]));
    assert.ok(outlets.size >= 3, `${id}: ${[...outlets].join(', ')}`);
  }
});
