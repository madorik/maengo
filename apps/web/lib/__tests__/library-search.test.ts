import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryMatcher, parseLibraryQuery } from '../library-search';

const entry = { title: '금융권 AI 해킹 피해 16개사 확산', short: '성명과 주민등록번호 등 약 10만 건이 유출됐어요.', sourceLabel: '한국경제TV뉴스', author: '연합뉴스' };

test('검색어 다듬기: 공백 정리, 빈 값은 null, 길이 상한', () => {
  assert.equal(parseLibraryQuery('  AI   해킹 '), 'AI 해킹');
  assert.equal(parseLibraryQuery('   '), null);
  assert.equal(parseLibraryQuery(undefined), null);
  assert.equal(parseLibraryQuery(['보안', '코인']), '보안');
  assert.equal(parseLibraryQuery('가'.repeat(100))!.length, 40);
});

test('띄어쓰기·대소문자를 가리지 않는다', () => {
  assert.equal(libraryMatcher('ai해킹')(entry), true);
  assert.equal(libraryMatcher('주민 등록')(entry), true);
});

test('낱말이 모두 들어가야 한다(제목·요약·출처)', () => {
  assert.equal(libraryMatcher('해킹 유출')(entry), true);
  assert.equal(libraryMatcher('해킹 비트코인')(entry), false);
  assert.equal(libraryMatcher('연합뉴스')(entry), true);
});

test('검색어가 없으면 모두 통과', () => {
  assert.equal(libraryMatcher(null)(entry), true);
});
