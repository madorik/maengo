import { isCategory, type CategoryId } from '@maengo/core/categories';
import type { Tier } from '@maengo/core/types';

// 소식 내용을 조립하는 순수 함수. DB에서 읽는 건 lib/server/feed.ts가 하고, 여기는 받은 줄만 다룬다(테스트: lib/__tests__/cluster-info.test.ts).
// 소식 하나 = 묶음(cluster) 하나: 요약(summaries) + 토픽별 why(cluster_why) + 묶인 글(items). 대표 글(rep_item_id)이 출처·주소가 된다.

/** 모든 플랜이 기본(basic) 요약을 본다(Pro 요약은 만들지 않는다, 2026-10-14). 앞에 있을수록 먼저 고른다 */
export const TIERS: Tier[] = ['basic'];

/** 목록 카드에 필요한 만큼(보관함) */
export interface ClusterCard {
  title: string;
  short: string;
  category: CategoryId;
  author: string | null;
  publishedAt: string | null;
  kind: 'article' | 'video';
  url: string;
  sourceLabel: string;
}

/** 소식 전체(오늘·상세·듣기) */
export interface ClusterInfo extends ClusterCard {
  body: string[];
  scenes?: { t: string; label: string }[];
  /** '○○에서도 다뤘어요'(대표 글 말고 다른 출처가 있을 때) */
  coverage?: string;
  /** 토픽 id → why 문구 */
  why: Map<string, string>;
}

export interface SummaryRow {
  cluster_id: number;
  tier: Tier;
  title: string;
  short: string;
  body: string[];
  category: string;
  author: string | null;
  published_at: string | null;
  scenes: { t: string; label: string }[] | null;
}
export interface WhyRow {
  cluster_id: number;
  topic_id: string;
  tier: Tier;
  why: string;
}
export interface ItemRow {
  id: number;
  cluster_id: number;
  canonical_url: string;
  kind: 'article' | 'video';
  author: string | null;
  sources: { name: string } | null;
}
export interface RepRow {
  id: number;
  rep_item_id: number | null;
}

/** 네 표에서 따로 읽은 줄들 */
export interface ClusterParts {
  summaries: SummaryRow[];
  whys: WhyRow[];
  reps: RepRow[];
  items: ItemRow[];
}

const tierRank = (t: Tier) => TIERS.indexOf(t);

/** 대표 글. 대표가 지워졌으면(rep_item_id null·없음) 아무 글이나 */
const pickRep = <T extends { id: number }>(items: T[], repId: number | null | undefined): T | undefined => items.find((m) => m.id === repId) ?? items[0];

/** 다른 출처 이름들(대표 글 출처는 뺀다, 중복 없이) → 안내 문구 */
function coverageOf(others: string[]): string | undefined {
  if (others.length === 0) return undefined;
  return others.length === 1 ? `${others[0]}에서도 다뤘어요` : `${others[0]} 외 ${others.length - 1}곳에서도 다뤘어요`;
}

/** ids 순서와 상관없이 묶음 id → 소식 내용. 요약이나 글이 없는 묶음은 뺀다 */
export function assembleClusterInfo(ids: number[], parts: ClusterParts): Map<number, ClusterInfo> {
  const out = new Map<number, ClusterInfo>();
  const best = new Map<number, SummaryRow>();
  for (const s of parts.summaries) {
    const cur = best.get(s.cluster_id);
    if (!cur || tierRank(s.tier) < tierRank(cur.tier)) best.set(s.cluster_id, s);
  }
  const why = new Map<number, Map<string, { tier: Tier; text: string }>>();
  for (const w of parts.whys) {
    const m = why.get(w.cluster_id) ?? why.set(w.cluster_id, new Map()).get(w.cluster_id)!;
    const cur = m.get(w.topic_id);
    if (!cur || tierRank(w.tier) < tierRank(cur.tier)) m.set(w.topic_id, { tier: w.tier, text: w.why });
  }
  const repOf = new Map(parts.reps.map((c) => [c.id, c.rep_item_id]));
  const members = new Map<number, ItemRow[]>();
  for (const it of parts.items) (members.get(it.cluster_id) ?? members.set(it.cluster_id, []).get(it.cluster_id)!).push(it);
  for (const id of new Set(ids)) {
    const s = best.get(id);
    const list = members.get(id) ?? [];
    const rep = pickRep(list, repOf.get(id));
    if (!s || !rep) continue;
    const others = [...new Set(list.filter((m) => m !== rep).map((m) => m.sources?.name).filter((n): n is string => !!n && n !== rep.sources?.name))];
    out.set(id, {
      title: s.title,
      short: s.short,
      body: s.body,
      category: isCategory(s.category) ? s.category : 'etc',
      author: s.author ?? rep.author,
      publishedAt: s.published_at,
      scenes: s.scenes ?? undefined,
      kind: rep.kind,
      url: rep.canonical_url,
      sourceLabel: rep.sources?.name ?? '',
      coverage: coverageOf(others),
      why: new Map([...(why.get(id) ?? new Map())].map(([t, v]) => [t, v.text])),
    });
  }
  return out;
}

/** 피드 줄(feeds)에 묶음을 같이 받았을 때(PostgREST embed)의 모양 */
export interface EmbeddedCluster {
  rep_item_id: number | null;
  summaries: SummaryRow[];
  cluster_why: WhyRow[];
  items: ItemRow[];
}

/** 같이 받은 묶음들을 네 표로 편다. 같은 묶음이 여러 줄(날짜)에 있으면 한 번만 */
export function partsOfEmbedded(rows: { cluster_id: number; clusters?: EmbeddedCluster | null }[]): ClusterParts {
  const parts: ClusterParts = { summaries: [], whys: [], reps: [], items: [] };
  const seen = new Set<number>();
  for (const r of rows) {
    if (!r.clusters || seen.has(r.cluster_id)) continue;
    seen.add(r.cluster_id);
    parts.reps.push({ id: r.cluster_id, rep_item_id: r.clusters.rep_item_id });
    parts.summaries.push(...r.clusters.summaries);
    parts.whys.push(...r.clusters.cluster_why);
    parts.items.push(...r.clusters.items);
  }
  return parts;
}

/** 보관함 카드용으로 같이 받은 묶음: 요약(전문·장면 없이)과 대표 글만(묶인 글을 다 받으면 크기가 두 배라) */
export interface EmbeddedCard {
  summaries: Pick<SummaryRow, 'title' | 'short' | 'category' | 'author' | 'published_at'>[];
  rep: Pick<ItemRow, 'canonical_url' | 'kind' | 'author' | 'sources'> | null;
}

/** 요약은 있는데 대표 글이 없는 묶음인지(대표 글이 지워진 경우. 지금은 없다). 이때는 전체 소식 내용을 따로 읽어 다른 글로 대신한다 */
export const repMissing = (c: EmbeddedCard | null | undefined): boolean => !!c && c.summaries.length > 0 && !c.rep;

/** 카드 하나. 요약이나 대표 글이 없으면 null */
export function cardOfEmbedded(c: EmbeddedCard | null | undefined): ClusterCard | null {
  const s = c?.summaries[0];
  const rep = c?.rep;
  if (!s || !rep) return null;
  return {
    title: s.title,
    short: s.short,
    category: isCategory(s.category) ? s.category : 'etc',
    author: s.author ?? rep.author,
    publishedAt: s.published_at,
    kind: rep.kind,
    url: rep.canonical_url,
    sourceLabel: rep.sources?.name ?? '',
  };
}
