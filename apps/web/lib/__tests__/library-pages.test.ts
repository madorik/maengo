import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendLibraryPage,
  libraryFilterKey,
  libraryPageSearch,
  librarySignature,
  mergeLibraryGroups,
  parseLibraryPageSearch,
  type LibraryGroup,
} from '../library-pages';
import type { LibraryEntry } from '../types';

const entry = (clusterId: number, feedDate: string): LibraryEntry => ({
  clusterId,
  feedDate,
  title: `소식 ${clusterId}`,
  short: '',
  kind: 'article',
  category: 'ai',
  sourceLabel: '출처',
  author: '출처',
  publishedLabel: '',
  read: false,
  listened: false,
});
const group = (date: string, ids: number[]): LibraryGroup => ({ date, label: date, entries: ids.map((id) => entry(id, date)) });
const shape = (groups: LibraryGroup[]) => groups.map((g) => [g.date, g.entries.map((e) => e.clusterId)]);

test('쪽 경계에 걸친 날짜는 한 묶음으로 합친다', () => {
  const page1 = [group('2026-10-18', [1, 2]), group('2026-10-17', [3, 4])];
  const page2 = [group('2026-10-17', [5, 6]), group('2026-10-16', [7])];
  assert.deepEqual(shape(mergeLibraryGroups(page1, page2)), [
    ['2026-10-18', [1, 2]],
    ['2026-10-17', [3, 4, 5, 6]],
    ['2026-10-16', [7]],
  ]);
});

test('겹친 소식(clusterId+feedDate)은 처음 것만, 다 겹친 묶음은 빠진다', () => {
  // 받는 사이 새 소식이 앞에 들어와 2쪽 앞부분이 1쪽 끝과 겹친 경우
  const page1 = [group('2026-10-18', [9, 1]), group('2026-10-17', [3])];
  const page2 = [group('2026-10-17', [3, 4]), group('2026-10-16', [5])];
  const page3 = [group('2026-10-16', [5])];
  assert.deepEqual(shape(mergeLibraryGroups(page1, page2, page3)), [
    ['2026-10-18', [9, 1]],
    ['2026-10-17', [3, 4]],
    ['2026-10-16', [5]],
  ]);
});

test('같은 소식이라도 피드 날짜가 다르면 따로 둔다', () => {
  const merged = mergeLibraryGroups([group('2026-10-18', [1])], [group('2026-10-17', [1])]);
  assert.deepEqual(shape(merged), [
    ['2026-10-18', [1]],
    ['2026-10-17', [1]],
  ]);
});

test('합쳐도 받은 쪽 데이터는 건드리지 않는다', () => {
  const page1 = [group('2026-10-17', [1])];
  const page2 = [group('2026-10-17', [2])];
  mergeLibraryGroups(page1, page2);
  assert.deepEqual(shape(page1), [['2026-10-17', [1]]]);
  assert.deepEqual(shape(page2), [['2026-10-17', [2]]]);
});

test('다음 쪽만 붙이고, 늦게 온 응답은 버리고, 서버가 앞 쪽으로 돌려주면 끝낸다', () => {
  const s = { page: 1, pageCount: 3, pages: [] };
  const p2 = { page: 2, pageCount: 3, groups: [group('2026-10-16', [5])] };
  const next = appendLibraryPage(s, 2, p2);
  assert.deepEqual({ page: next.page, pageCount: next.pageCount, n: next.pages.length }, { page: 2, pageCount: 3, n: 1 });
  assert.equal(appendLibraryPage(next, 2, p2), next);
  // 목록이 줄어 3쪽을 달라 했는데 2쪽이 왔다
  const ended = appendLibraryPage(next, 3, { page: 2, pageCount: 2, groups: [] });
  assert.deepEqual({ page: ended.page, pageCount: ended.pageCount, n: ended.pages.length }, { page: 2, pageCount: 2, n: 1 });
});

test('쪽 받기 주소: 만들고 읽으면 같고, 이상한 값은 null', () => {
  const f = { category: 'ai' as const, read: 'unread' as const, query: 'AI 해킹' };
  assert.deepEqual(parseLibraryPageSearch(new URLSearchParams(libraryPageSearch(2, f))), { page: 2, ...f });
  assert.deepEqual(parseLibraryPageSearch(new URLSearchParams('page=3')), { page: 3, category: null, read: null, query: null });
  assert.equal(parseLibraryPageSearch(new URLSearchParams('')), null);
  assert.equal(parseLibraryPageSearch(new URLSearchParams('page=0')), null);
  assert.equal(parseLibraryPageSearch(new URLSearchParams('page=1.5')), null);
  assert.equal(parseLibraryPageSearch(new URLSearchParams('page=99999')), null);
  assert.equal(parseLibraryPageSearch(new URLSearchParams('page=2&category=nope')), null);
  assert.equal(parseLibraryPageSearch(new URLSearchParams('page=2&read=read')), null);
});

test('거르기 열쇠·1쪽 확인 값', () => {
  assert.notEqual(libraryFilterKey({ category: 'ai', read: null, query: null }), libraryFilterKey({ category: null, read: null, query: 'ai' }));
  const groups = [group('2026-10-18', [1, 2])];
  assert.equal(librarySignature({ filteredTotal: 12, pageCount: 2, groups }), librarySignature({ filteredTotal: 12, pageCount: 2, groups: [group('2026-10-18', [1, 2])] }));
  assert.notEqual(librarySignature({ filteredTotal: 12, pageCount: 2, groups }), librarySignature({ filteredTotal: 13, pageCount: 2, groups }));
});

test('앞 쪽을 받은 뒤 목록이 줄어도(읽음 거르기) 겹쳐 받은 다음 쪽으로 건너뛴 소식이 채워진다', () => {
  // 1쪽은 1~4. 그사이 2를 읽어 '안 읽음' 목록이 줄면 5가 앞 쪽 끝으로 당겨진다. 다음 쪽은 앞 쪽을 겹쳐 3~8로 온다
  const page1 = [group('2026-10-18', [1, 2, 3, 4])];
  const page2 = [group('2026-10-18', [3, 4, 5]), group('2026-10-17', [6, 7, 8])];
  assert.deepEqual(shape(mergeLibraryGroups(page1, page2)), [
    ['2026-10-18', [1, 2, 3, 4, 5]],
    ['2026-10-17', [6, 7, 8]],
  ]);
});
