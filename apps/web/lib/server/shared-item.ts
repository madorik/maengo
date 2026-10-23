import 'server-only';
import { cache } from 'react';
import { isCategory, type CategoryId } from '@maengo/core/categories';
import { db, must } from './db';

// 공유받은 사람이 로그인 없이 보는 소식 한 건(/s/[id], 2026-10-23). 공개 분야 페이지(public-topics.ts)와 같은 범위만 보인다:
// 제목·한 줄 요약·출처·원문 링크. 다시 쓴 전체 글과 사람마다 다른 것(why·읽음)은 넣지 않는다.
// 사용자가 넣은 출처(내 관심 링크, sources.custom)의 글뿐인 소식과 걸러 낸 소식(skip_reason)은 없는 것으로 친다.

export interface SharedItem {
  clusterId: number;
  title: string;
  short: string;
  category: CategoryId;
  kind: 'article' | 'video';
  url: string;
  sourceLabel: string;
  /** 발행일(없으면 처음 본 날), ISO */
  date: string;
}

interface Row {
  title: string;
  short: string;
  category: string;
  published_at: string | null;
  clusters: { first_seen_at: string; skip_reason: string | null; rep_item_id: number | null };
}

interface MemberRow {
  id: number;
  canonical_url: string;
  kind: 'article' | 'video';
  sources: { name: string; custom: boolean } | null;
}

export const sharedItem = cache(async (clusterId: number): Promise<SharedItem | null> => {
  if (!Number.isSafeInteger(clusterId) || clusterId <= 0) return null;
  const row = must(
    await db
      .from('summaries')
      .select('title,short,category,published_at,clusters!inner(first_seen_at,skip_reason,rep_item_id)')
      .eq('cluster_id', clusterId)
      .eq('tier', 'basic')
      .maybeSingle(),
    'shared summary',
  ) as unknown as Row | null;
  if (!row || row.clusters.skip_reason) return null;
  const members = (
    must(await db.from('items').select('id,canonical_url,kind,sources(name,custom)').eq('cluster_id', clusterId), 'shared items') as unknown as MemberRow[]
  ).filter((m) => m.sources && !m.sources.custom);
  // 대표 글이 공개 출처면 그 글, 아니면 공개 출처 글 중 첫 글
  const rep = members.find((m) => m.id === row.clusters.rep_item_id) ?? members[0];
  if (!rep) return null;
  return {
    clusterId,
    title: row.title,
    short: row.short,
    category: isCategory(row.category) ? row.category : 'etc',
    kind: rep.kind,
    url: rep.canonical_url,
    sourceLabel: rep.sources!.name,
    date: row.published_at ?? row.clusters.first_seen_at,
  };
});
