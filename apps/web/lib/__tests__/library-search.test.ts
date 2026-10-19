import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryTerms, parseLibraryQuery } from '../library-search';

test('검색어 다듬기: 공백 정리, 빈 값은 null, 길이 상한', () => {
  assert.equal(parseLibraryQuery('  AI   해킹 '), 'AI 해킹');
  assert.equal(parseLibraryQuery('   '), null);
  assert.equal(parseLibraryQuery(undefined), null);
  assert.equal(parseLibraryQuery(['보안', '코인']), '보안');
  assert.equal(parseLibraryQuery('가'.repeat(100))!.length, 40);
});

test('낱말: 소문자로, 띄어쓰기 없이, 빈 낱말은 뺀다', () => {
  assert.deepEqual(libraryTerms('AI 해킹'), ['ai', '해킹']);
  assert.deepEqual(libraryTerms('  주민  등록 '), ['주민', '등록']);
  assert.deepEqual(libraryTerms(null), []);
  assert.deepEqual(libraryTerms(''), []);
});
