import { db, check, fromVector, inChunks, selectAll, toVector } from '../lib/db';
import { add, cosine, normalize } from '../lib/vec';
import { HOUR, type Ctx } from '../lib/ctx';

// 4. cluster: 창 안의 글을 묶음 중심 벡터와 비교해 코사인 ≥ 0.82이면 같은 소식으로 묶는다.
// 2026-10-09 첫 수집분(391개)으로 맞췄다. 제목+RSS 설명 임베딩에서 출처가 다른 같은 소식(한·영 기사 쌍)은 0.81~0.87에 몰려 있었다.
// 같은 출처의 글끼리는 묶지 않는다. 같은 유튜브 채널의 다른 영상, 같은 블로그의 연재 글이 설명란 상투어 때문에 0.84~0.9까지 올라간다.
export const CLUSTER_THRESHOLD = Number(process.env.PIPELINE_CLUSTER_THRESHOLD) || 0.82;

interface ItemRow {
  id: number;
  embedding: unknown;
  cluster_id: number | null;
  kind: 'article' | 'video';
  source_id: number | null;
  published_at: string | null;
}

interface Group {
  /** 기존 클러스터 id, 새 클러스터면 null */
  id: number | null;
  sum: number[];
  /** DB에 이미 있던 구성원 수(창 밖 포함) + 이번에 붙은 수 */
  size: number;
  members: { id: number; weight: number; at: number; kind: 'article' | 'video' }[];
  sources: Set<number>;
  touched: boolean;
  firstSeen: number;
}

export async function cluster(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
  const items = await selectAll<ItemRow>((from, to) =>
    db.from('items').select('id,embedding,cluster_id,kind,source_id,published_at').not('embedding', 'is', null).gte('published_at', since).order('id').range(from, to),
  );
  const weights = new Map<number, number>(
    (check(await db.from('sources').select('id,weight'), 'sources') as { id: number; weight: number }[]).map((s) => [s.id, s.weight]),
  );

  const clusterIds = [...new Set(items.map((i) => i.cluster_id).filter((x): x is number => x != null))];
  const existing = new Map<number, { size: number; first_seen_at: string }>();
  await inChunks(clusterIds, 200, async (ids) => {
    const rows = check(await db.from('clusters').select('id,size,first_seen_at').in('id', ids), 'clusters') as { id: number; size: number; first_seen_at: string }[];
    for (const r of rows) existing.set(r.id, r);
  });

  const groups: Group[] = [];
  const byId = new Map<number, Group>();
  const vec = new Map<number, number[]>();
  const pending: ItemRow[] = [];
  for (const it of items) {
    const v = fromVector(it.embedding);
    if (!v) continue;
    vec.set(it.id, v);
    const member = { id: it.id, weight: weights.get(it.source_id ?? -1) ?? 1, at: Date.parse(it.published_at ?? ctx.now.toISOString()), kind: it.kind };
    if (it.cluster_id == null) {
      pending.push(it);
      continue;
    }
    let g = byId.get(it.cluster_id);
    if (!g) {
      const row = existing.get(it.cluster_id);
      g = { id: it.cluster_id, sum: new Array(v.length).fill(0), size: row?.size ?? 0, members: [], sources: new Set(), touched: false, firstSeen: Date.parse(row?.first_seen_at ?? it.published_at ?? '') };
      byId.set(it.cluster_id, g);
      groups.push(g);
    }
    add(g.sum, v);
    g.members.push(member);
    if (it.source_id != null) g.sources.add(it.source_id);
  }

  // 오래된 글부터 붙인다. 이번에 새로 만든 묶음에도 다음 글이 붙을 수 있다
  pending.sort((a, b) => Date.parse(a.published_at ?? '') - Date.parse(b.published_at ?? ''));
  const centroids = new Map<Group, number[]>(groups.map((g) => [g, normalize(g.sum)]));
  const assigned = new Map<number, Group>();
  let joined = 0;
  for (const it of pending) {
    const v = vec.get(it.id)!;
    let best: Group | null = null;
    let bestCos = -1;
    for (const [g, c] of centroids) {
      if (it.source_id != null && g.sources.has(it.source_id)) continue;
      const s = cosine(v, c);
      if (s > bestCos) [best, bestCos] = [g, s];
    }
    const member = { id: it.id, weight: weights.get(it.source_id ?? -1) ?? 1, at: Date.parse(it.published_at ?? ctx.now.toISOString()), kind: it.kind };
    let g: Group;
    if (best && bestCos >= CLUSTER_THRESHOLD) {
      g = best;
      joined++;
    } else {
      g = { id: null, sum: new Array(v.length).fill(0), size: 0, members: [], sources: new Set(), touched: true, firstSeen: member.at };
      groups.push(g);
    }
    add(g.sum, v);
    g.members.push(member);
    if (it.source_id != null) g.sources.add(it.source_id);
    g.size++;
    g.touched = true;
    g.firstSeen = Math.min(g.firstSeen, member.at);
    centroids.set(g, normalize(g.sum));
    assigned.set(it.id, g);
  }

  // 새 묶음을 만들고 id를 받는다. 처음 붙은 글 id(rep_item_id)로 짝을 맞춘다
  const fresh = groups.filter((g) => g.id == null);
  const nowIso = ctx.now.toISOString();
  await inChunks(fresh, 200, async (chunk) => {
    const rows = check(
      await db
        .from('clusters')
        .insert(chunk.map((g) => ({ rep_item_id: g.members[0]!.id, first_seen_at: new Date(g.firstSeen).toISOString(), last_seen_at: nowIso })))
        .select('id,rep_item_id'),
      'clusters insert',
    ) as { id: number; rep_item_id: number }[];
    const idByRep = new Map(rows.map((r) => [r.rep_item_id, r.id]));
    for (const g of chunk) g.id = idByRep.get(g.members[0]!.id) ?? null;
  });

  const links = [...assigned].map(([itemId, g]) => ({ id: itemId, c: g.id }));
  await inChunks(links, 200, async (chunk) => {
    check(await db.rpc('set_item_clusters', { p: chunk }), 'set_item_clusters');
  });

  // 바뀐 묶음의 크기·중심·대표 글을 고친다. 대표는 출처 가중치가 가장 높은 글(같으면 먼저 나온 글)
  const touched = groups.filter((g) => g.touched && g.id != null);
  const updates = touched.map((g) => {
    const rep = [...g.members].sort((a, b) => b.weight - a.weight || a.at - b.at)[0]!;
    return {
      id: g.id!,
      size: g.size,
      centroid: toVector(centroids.get(g)!),
      rep_item_id: rep.id,
      is_video: rep.kind === 'video',
      last_seen_at: nowIso,
      first_seen_at: new Date(g.firstSeen).toISOString(),
    };
  });
  await inChunks(updates, 100, async (chunk) => {
    check(await db.from('clusters').upsert(chunk, { onConflict: 'id' }), 'clusters update');
  });

  ctx.stats.cluster = { pending: pending.length, joined, created: fresh.length, touched: touched.length };
  ctx.log(`cluster: 새 글 ${pending.length}개 → 기존 묶음에 ${joined}개, 새 묶음 ${fresh.length}개`);
}
