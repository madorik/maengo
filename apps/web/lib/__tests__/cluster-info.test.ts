import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleClusterInfo, partsOfEmbedded, type ItemRow, type SummaryRow } from '../cluster-info';

const summary = (cluster_id: number, over: Partial<SummaryRow> = {}): SummaryRow => ({
  cluster_id,
  tier: 'basic',
  title: `소식 ${cluster_id}`,
  short: '요약',
  body: ['첫 문단'],
  category: 'ai',
  author: null,
  published_at: '2026-10-19T00:00:00Z',
  scenes: null,
  ...over,
});
const item = (id: number, cluster_id: number, source: string | null, over: Partial<ItemRow> = {}): ItemRow => ({
  id,
  cluster_id,
  canonical_url: `https://example.com/${id}`,
  kind: 'article',
  author: `글쓴이 ${id}`,
  sources: source ? { name: source } : null,
  ...over,
});

test('대표 글이 출처·주소가 되고, 다른 출처는 coverage로', () => {
  const info = assembleClusterInfo([1], {
    summaries: [summary(1)],
    whys: [{ cluster_id: 1, topic_id: 'ai', tier: 'basic', why: 'AI라면' }],
    reps: [{ id: 1, rep_item_id: 12 }],
    items: [item(11, 1, '긱뉴스'), item(12, 1, '해커뉴스', { kind: 'video' }), item(13, 1, '긱뉴스'), item(14, 1, '해커뉴스')],
  });
  const c = info.get(1)!;
  assert.equal(c.url, 'https://example.com/12');
  assert.equal(c.kind, 'video');
  assert.equal(c.sourceLabel, '해커뉴스');
  // 대표와 같은 출처(해커뉴스)는 빼고, 긱뉴스는 한 번만
  assert.equal(c.coverage, '긱뉴스에서도 다뤘어요');
  assert.equal(c.author, '글쓴이 12');
  assert.deepEqual([...c.why], [['ai', 'AI라면']]);
});

test('다른 출처가 둘 이상이면 외 n곳, 요약 글쓴이가 있으면 그것을 쓴다', () => {
  const info = assembleClusterInfo([1], {
    summaries: [summary(1, { author: 'Anthropic', category: '없는-카테고리' })],
    whys: [],
    reps: [{ id: 1, rep_item_id: 11 }],
    items: [item(11, 1, 'A'), item(12, 1, 'B'), item(13, 1, 'C')],
  });
  const c = info.get(1)!;
  assert.equal(c.coverage, 'B 외 1곳에서도 다뤘어요');
  assert.equal(c.author, 'Anthropic');
  assert.equal(c.category, 'etc');
  assert.equal(c.why.size, 0);
});

test('대표 글이 지워졌으면 아무 글이나, 요약이나 글이 없으면 뺀다', () => {
  const info = assembleClusterInfo([1, 2, 3, 1], {
    summaries: [summary(1), summary(3)],
    whys: [],
    reps: [{ id: 1, rep_item_id: null }, { id: 2, rep_item_id: 21 }, { id: 3, rep_item_id: 31 }],
    items: [item(11, 1, 'A'), item(21, 2, 'B')],
  });
  assert.deepEqual([...info.keys()], [1]);
  assert.equal(info.get(1)!.url, 'https://example.com/11');
  assert.equal(info.get(1)!.coverage, undefined);
});

test('같이 받은 묶음은 네 표로 펴고, 같은 묶음은 한 번만', () => {
  const cluster = { rep_item_id: 11, summaries: [summary(1)], cluster_why: [{ cluster_id: 1, topic_id: 'ai', tier: 'basic' as const, why: 'w' }], items: [item(11, 1, 'A')] };
  const parts = partsOfEmbedded([
    { cluster_id: 1, clusters: cluster },
    { cluster_id: 1, clusters: cluster },
    { cluster_id: 2, clusters: null },
  ]);
  assert.equal(parts.reps.length, 1);
  assert.equal(parts.summaries.length, 1);
  assert.equal(parts.whys.length, 1);
  assert.equal(parts.items.length, 1);
  assert.equal(assembleClusterInfo([1, 2], parts).size, 1);
});
