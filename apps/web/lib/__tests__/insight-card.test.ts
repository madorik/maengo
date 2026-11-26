import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alsoOf, pointsOf, shortLabel, whoOf } from '../insight-card';

test('관심 이름 줄이기: 앞말을 떼고 분야는 "○○ 분야"로', () => {
  assert.equal(shortLabel('신경 쓰는 국내 주식'), '국내 주식');
  assert.equal(shortLabel('관심 있는 반도체'), '반도체');
  assert.equal(shortLabel('내 키워드 전기차'), '전기차');
  assert.equal(shortLabel('고른 IT/과학 분야'), 'IT/과학 분야');
  assert.equal(shortLabel('자주 보는 경제'), '경제 분야');
  assert.equal(shortLabel('IT·개발 일'), 'IT·개발 일');
  assert.equal(shortLabel('전세'), '전세');
});

test('카드가 짚을 관심: 고른 사정·키워드가 분야보다 먼저', () => {
  assert.equal(whoOf(['고른 경제 분야', '신경 쓰는 국내 주식']), '국내 주식');
  assert.equal(whoOf(['신경 쓰는 미국 주식', '신경 쓰는 대출 이자']), '미국 주식');
  assert.equal(whoOf(['고른 부동산 분야']), '부동산 분야');
  assert.equal(whoOf([]), '');
  assert.equal(whoOf(undefined), '');
});

test('핵심 요약 두 줄: 형식 14는 points, 예전 형식은 사실 + 설명 첫 문장', () => {
  assert.deepEqual(pointsOf({ points: ['코스피 급락', '16개국 관세안 예고', '셋째'], fact: '무시', text: '무시.' }), ['코스피 급락', '16개국 관세안 예고']);
  assert.deepEqual(
    pointsOf({ fact: '코스피 급락으로 매도 사이드카 발동', text: '미국 기술주 약세에 코스피가 급락했어요. 관세 수위를 봐야 해요.' }),
    ['코스피 급락으로 매도 사이드카 발동', '미국 기술주 약세에 코스피가 급락했어요.'],
  );
  assert.deepEqual(pointsOf({ text: '첫 문장이에요. 둘째 문장이에요. 셋째예요.' }), ['첫 문장이에요.', '둘째 문장이에요.']);
});

test('두 번째 관심: 같은 흐름 소식의 맞춤 체크 가운데 첫 관심과 다른 것', () => {
  const personal = [
    { id: 1, about: '신경 쓰는 미국 주식', tone: 'minus' as const },
    { id: 1, about: '신경 쓰는 대출 이자', tone: 'watch' as const },
    { id: 9, about: '전세', tone: 'plus' as const },
  ];
  assert.deepEqual(alsoOf({ ids: [1, 2] }, '미국 주식', personal), { who: '대출 이자', tone: 'watch' });
  assert.equal(alsoOf({ ids: [2] }, '미국 주식', personal), null);
  assert.equal(alsoOf({ ids: [1] }, '미국 주식', [{ id: 1, about: '신경 쓰는 미국 주식', tone: 'minus' }]), null);
  assert.equal(alsoOf({ ids: [1] }, '미국 주식', undefined), null);
});
