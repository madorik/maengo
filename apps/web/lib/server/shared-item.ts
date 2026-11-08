import 'server-only';
import { cache } from 'react';
import { isCategory, type CategoryId } from '@maengo/core/categories';
import { db, must } from './db';

// 공유받은 사람이 로그인 없이 보는 소식 한 건(/s/<토큰>, 2026-10-23, 토큰은 share-token.ts). 제목·한 줄 요약·다시 쓴 전체 글·출처·원문 링크.
// 2026-11-08 사용자: 전체 글도 보여 준다(처음엔 공개 분야 페이지처럼 한 줄 요약까지만). 검색에는 내지 않는다(noindex). 사람마다 다른 것(why·읽음)은 넣지 않는다.
// 걸러 낸 소식(skip_reason)은 없는 것으로 친다. 내 관심 링크(사용자가 넣은 출처, 유튜브 채널 포함)의 글뿐인 소식도 보인다
// (2026-11-08 사용자: 공유는 늘 맹고 소식 주소여야 한다. 처음엔 없는 것으로 쳐서 공유가 원문 주소를 보냈다).

export interface SharedItem {
  clusterId: number;
  title: string;
  short: string;
  /** 다시 쓴 전체 글(문단) */
  body: string[];
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
  body: string[] | null;
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
      .select('title,short,body,category,published_at,clusters!inner(first_seen_at,skip_reason,rep_item_id)')
      .eq('cluster_id', clusterId)
      .eq('tier', 'basic')
      .maybeSingle(),
    'shared summary',
  ) as unknown as Row | null;
  if (!row || row.clusters.skip_reason) return null;
  const all = (
    must(await db.from('items').select('id,canonical_url,kind,sources(name,custom)').eq('cluster_id', clusterId), 'shared items') as unknown as MemberRow[]
  ).filter((m) => m.sources);
  // 공개 출처 글을 먼저(대표 글이 공개 출처면 그 글), 없으면 내 관심 링크 글(대표 글 먼저)
  const open = all.filter((m) => !m.sources!.custom);
  const pool = open.length ? open : all;
  const rep = pool.find((m) => m.id === row.clusters.rep_item_id) ?? pool[0];
  if (!rep) return null;
  return {
    clusterId,
    title: row.title,
    short: row.short,
    body: (row.body ?? []).filter((p) => p?.trim()),
    category: isCategory(row.category) ? row.category : 'etc',
    kind: rep.kind,
    url: rep.canonical_url,
    sourceLabel: rep.sources!.name,
    date: row.published_at ?? row.clusters.first_seen_at,
  };
});
