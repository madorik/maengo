import { db, check, fromVector, selectAll, toVector } from '../lib/db';
import { cosine } from '../lib/vec';
import { HOUR, type Ctx } from '../lib/ctx';

// 7-1. dedupe: 요약이 끝난 묶음끼리 한국어 요약 벡터를 비교해 같은 소식을 합친다.
// 원문 임베딩은 영어 기사와 한국어 기사가 0.79 정도로 갈려 cluster 단계에서 못 묶는 경우가 있다.
// 2026-10-09 실측: 같은 소식의 한국어 요약끼리 0.90, 다른 소식은 0.56~0.65.
const DUP_THRESHOLD = Number(process.env.PIPELINE_DUP_THRESHOLD) || 0.86;

interface Row {
  cluster_id: number;
  title: string;
  short: string;
  clusters: { first_seen_at: string; size: number; summary_vec: unknown; skip_reason: string | null };
}

export async function dedupe(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - 7 * 24 * HOUR).toISOString();
  const rows = (
    await selectAll<Row>((f, t) =>
      db
        .from('summaries')
        .select('cluster_id,title,short,clusters!inner(first_seen_at,size,summary_vec,skip_reason)')
        .eq('tier', 'basic')
        .gte('clusters.first_seen_at', since)
        .is('clusters.skip_reason', null)
        .order('cluster_id')
        .range(f, t),
    )
  );
  const fresh = rows.filter((r) => !fromVector(r.clusters.summary_vec));
  if (!fresh.length) {
    ctx.stats.dedupe = { embedded: 0, merged: 0 };
    return;
  }
  const vecs = await ctx.ai.embed(fresh.map((r) => `${r.title}\n${r.short}`));
  for (const [i, r] of fresh.entries()) {
    check(await db.from('clusters').update({ summary_vec: toVector(vecs[i]!) }).eq('id', r.cluster_id), 'summary_vec');
    r.clusters.summary_vec = vecs[i];
  }

  // 먼저 나온 묶음을 남기고, 나중 묶음의 글을 거기로 옮긴다
  const ordered = [...rows].sort((a, b) => Date.parse(a.clusters.first_seen_at) - Date.parse(b.clusters.first_seen_at) || a.cluster_id - b.cluster_id);
  const freshIds = new Set(fresh.map((r) => r.cluster_id));
  const kept: Row[] = [];
  const merges: { dup: Row; keep: Row; cos: number }[] = [];
  for (const r of ordered) {
    const v = fromVector(r.clusters.summary_vec)!;
    let best: { keep: Row; cos: number } | null = null;
    for (const k of kept) {
      if (!freshIds.has(r.cluster_id) && !freshIds.has(k.cluster_id)) continue; // 이미 비교한 쌍
      const c = cosine(v, fromVector(k.clusters.summary_vec)!);
      if (c >= DUP_THRESHOLD && (!best || c > best.cos)) best = { keep: k, cos: c };
    }
    if (best) merges.push({ dup: r, keep: best.keep, cos: best.cos });
    else kept.push(r);
  }

  for (const { dup, keep, cos } of merges) {
    const d = dup.cluster_id;
    const k = keep.cluster_id;
    check(await db.from('items').update({ cluster_id: k }).eq('cluster_id', d), 'items move');
    check(await db.from('clusters').update({ size: keep.clusters.size + dup.clusters.size }).eq('id', k), 'clusters size');
    keep.clusters.size += dup.clusters.size;
    check(await db.from('clusters').update({ skip_reason: `중복 #${k}`, size: 0 }).eq('id', d), 'clusters skip');
    check(await db.from('summaries').delete().eq('cluster_id', d), 'summaries delete');
    check(await db.from('cluster_why').delete().eq('cluster_id', d), 'cluster_why delete');
    check(await db.from('cluster_topics').delete().eq('cluster_id', d), 'cluster_topics delete');
    // 이미 피드에 들어갔으면 뺀다(같은 날 남긴 묶음과 겹치지 않게). 보이는 개수는 웹이 다시 맞춘다
    check(await db.from('feeds').delete().eq('cluster_id', d), 'feeds delete');
    ctx.log(`  중복 합침 #${d} → #${k} (${cos.toFixed(3)}) ${dup.title} ≈ ${keep.title}`);
  }
  ctx.stats.dedupe = { embedded: fresh.length, merged: merges.length };
  ctx.log(`dedupe: 요약 ${fresh.length}개 벡터화 · 중복 ${merges.length}개 합침`);
}
