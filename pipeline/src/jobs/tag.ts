import { isNewsSection, NEWS_SECTIONS, withParents } from '@maengo/core/topics';
import { dictionary } from '../lib/audience';
import { db, check, fromVector, inChunks, selectAll, toVector } from '../lib/db';
import { headlineOf, MIN_OUTLETS, SECTION_BY_SOURCE_URL } from '../lib/headline';
import { cosine } from '../lib/vec';
import { HOUR, type Ctx } from '../lib/ctx';

// 5. tag: 묶음 중심 벡터와 토픽 벡터를 비교해 관련 토픽(최대 3개)을 붙인다.
// 이것은 "누구에게 요약해 줄 만한가"를 고르는 1차 거름망이다. 요약 단계가 AI로 토픽을 다시 붙인다.
// 2026-10-09 첫 수집분(묶음 363개)으로 맞췄다. 최고 코사인 중앙값 0.587, 상위 10% 0.653.
// 1순위 토픽은 0.56 위에서 대체로 맞았지만 2·3순위는 엉뚱한 경우가 많았다(보안 패치 기사에 원격 근무 0.52 등).
// 그래서 1순위와 0.04 안쪽으로 붙은 토픽만 같이 남기고, 코사인 0.55~0.70을 관련도 0~1로 편다.
// 뉴스 분야(정치·경제 등)는 임베딩으로 태그하지 않는다. 여러 언론사가 같이 다룬 묶음에만 tagHeadlines가 붙인다.
const FLOOR = Number(process.env.PIPELINE_TAG_FLOOR) || 0.55;
const CEIL = Number(process.env.PIPELINE_TAG_CEIL) || 0.7;
const MARGIN = 0.04;

/** 토픽 벡터 입력. 이름·별칭을 같이 넣어 한·영 글 모두와 맞게 한다(직접 입력 관심사는 별칭이 없다) */
export const topicText = (t: { name: string; aliases: string[] }) => `${t.name} 관련 소식${t.aliases.length ? ` (${t.aliases.join(', ')})` : ''}`;

export async function topicVectors(ctx: Ctx): Promise<Map<string, number[]>> {
  const known = new Set((await dictionary(ctx)).filter((t) => !isNewsSection(t.id)).map((t) => t.id));
  const all = check(await db.from('topics').select('id,name,aliases,embedding'), 'topics') as { id: string; name: string; aliases: string[]; embedding: unknown }[];
  const rows = all.filter((r) => known.has(r.id));
  const missing = rows.filter((r) => !fromVector(r.embedding));
  if (missing.length) {
    const vecs = await ctx.ai.embed(missing.map(topicText));
    for (const [i, r] of missing.entries()) {
      check(await db.from('topics').update({ embedding: toVector(vecs[i]!) }).eq('id', r.id), 'topics embedding');
      r.embedding = vecs[i];
    }
    ctx.log(`tag: 토픽 벡터 ${missing.length}개 새로 만듦`);
  }
  return new Map(rows.map((r) => [r.id, fromVector(r.embedding)!]));
}

export function tagsFor(centroid: number[], topics: Map<string, number[]>) {
  const ranked = [...topics].map(([topicId, v]) => ({ topicId, cos: cosine(centroid, v) })).sort((a, b) => b.cos - a.cos);
  const top = ranked[0]?.cos ?? 0;
  return ranked
    .slice(0, 3)
    .filter((t) => t.cos >= top - MARGIN)
    .map((t) => ({ topicId: t.topicId, cos: t.cos, relevance: Math.min(1, Math.max(0, (t.cos - FLOOR) / (CEIL - FLOOR))) }))
    .filter((t) => t.relevance > 0);
}

export async function tag(ctx: Ctx) {
  const topics = await topicVectors(ctx);
  const since = new Date(ctx.now.getTime() - 7 * 24 * HOUR).toISOString();
  const clusters = await selectAll<{ id: number; centroid: unknown; tagged_at: string | null; last_seen_at: string }>((from, to) =>
    db.from('clusters').select('id,centroid,tagged_at,last_seen_at').is('skip_reason', null).gte('last_seen_at', since).not('centroid', 'is', null).order('id').range(from, to),
  );
  // AI가 이미 토픽을 붙인(요약이 있는) 묶음은 건드리지 않는다
  const summarized = new Set<number>();
  await inChunks(clusters.map((c) => c.id), 200, async (ids) => {
    const rows = check(await db.from('summaries').select('cluster_id').eq('tier', 'basic').in('cluster_id', ids), 'summaries') as { cluster_id: number }[];
    for (const r of rows) summarized.add(r.cluster_id);
  });
  const todo = clusters.filter((c) => !summarized.has(c.id) && (ctx.force || !c.tagged_at || c.tagged_at < c.last_seen_at));

  const rows: { cluster_id: number; topic_id: string; relevance: number }[] = [];
  const tops: number[] = [];
  for (const c of todo) {
    // 상세 관심사로 잡히면 큰 분류에도 잡히게 한다("백엔드"만 고른 사람에게도 PostgreSQL 소식이 가게)
    const tags = withParents(tagsFor(fromVector(c.centroid)!, topics));
    const top = [...topics.values()].reduce((m, v) => Math.max(m, cosine(fromVector(c.centroid)!, v)), -1);
    tops.push(top);
    for (const t of tags) rows.push({ cluster_id: c.id, topic_id: t.topicId, relevance: Number(t.relevance.toFixed(3)) });
  }
  await inChunks(todo.map((c) => c.id), 200, async (ids) => {
    check(await db.from('cluster_topics').delete().in('cluster_id', ids), 'cluster_topics delete');
    check(await db.from('clusters').update({ tagged_at: ctx.now.toISOString() }).in('id', ids), 'clusters tagged_at');
  });
  await inChunks(rows, 500, async (chunk) => {
    check(await db.from('cluster_topics').insert(chunk), 'cluster_topics insert');
  });

  tops.sort((a, b) => a - b);
  const q = (p: number) => (tops.length ? tops[Math.floor((tops.length - 1) * p)]!.toFixed(3) : '-');
  const tagged = new Set(rows.map((r) => r.cluster_id)).size;
  ctx.stats.tag = { clusters: todo.length, tagged, rows: rows.length, topCos: { p10: q(0.1), p50: q(0.5), p90: q(0.9) } };
  ctx.log(`tag: 묶음 ${todo.length}개 중 ${tagged}개에 토픽 ${rows.length}개 (최고 코사인 p10 ${q(0.1)} · p50 ${q(0.5)} · p90 ${q(0.9)})`);

  // 위에서 다시 태그한 묶음은 뉴스 분야 태그도 지워졌으니 바로 다시 붙인다
  await tagHeadlines(ctx);
}

const NEWS_IDS = NEWS_SECTIONS.map((t) => t.id);

/**
 * 5-1. 뉴스 분야 헤드라인: 국내 언론사 MIN_OUTLETS곳 이상이 같이 다룬 묶음에 그 분야 토픽을 붙인다(관련도 1, lib/headline.ts).
 * 요약이 끝난 묶음도 다시 본다. 요약한 뒤에 언론사가 더 붙어 헤드라인이 될 수 있어서다(요약은 뉴스 분야 태그를 지우지 않는다).
 * 언론사 3곳이 되려면 묶음 크기도 3 이상이라, 크기로 먼저 거른다.
 */
export async function tagHeadlines(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
  const clusters = await selectAll<{ id: number }>((from, to) =>
    db.from('clusters').select('id').is('skip_reason', null).gte('last_seen_at', since).gte('size', MIN_OUTLETS).order('id').range(from, to),
  );
  const sources = check(await db.from('sources').select('id,url,lang'), 'sources') as { id: number; url: string; lang: 'ko' | 'en' }[];
  const sourceOf = new Map(sources.map((s) => [s.id, { lang: s.lang, section: SECTION_BY_SOURCE_URL.get(s.url) ?? null }]));

  const want = new Map<number, string>();
  const have = new Map<number, string[]>();
  await inChunks(clusters.map((c) => c.id), 200, async (ids) => {
    const items = await selectAll<{ cluster_id: number; source_id: number | null; canonical_url: string; title: string; kind: 'article' | 'video' }>((from, to) =>
      db.from('items').select('cluster_id,source_id,canonical_url,title,kind').in('cluster_id', ids).order('id').range(from, to),
    );
    const byCluster = new Map<number, typeof items>();
    for (const it of items) (byCluster.get(it.cluster_id) ?? byCluster.set(it.cluster_id, []).get(it.cluster_id)!).push(it);
    for (const [id, members] of byCluster) {
      const h = headlineOf(
        members.map((m) => ({ url: m.canonical_url, title: m.title, kind: m.kind, ...(sourceOf.get(m.source_id ?? -1) ?? { lang: null, section: null }) })),
      );
      if (h) want.set(id, h.section);
    }
    const rows = check(await db.from('cluster_topics').select('cluster_id,topic_id').in('cluster_id', ids).in('topic_id', NEWS_IDS), 'cluster_topics news') as {
      cluster_id: number;
      topic_id: string;
    }[];
    for (const r of rows) (have.get(r.cluster_id) ?? have.set(r.cluster_id, []).get(r.cluster_id)!).push(r.topic_id);
  });

  const removed = new Map<string, number[]>();
  const added: { cluster_id: number; topic_id: string; relevance: number }[] = [];
  for (const { id } of clusters) {
    const section = want.get(id);
    for (const t of have.get(id) ?? []) if (t !== section) (removed.get(t) ?? removed.set(t, []).get(t)!).push(id);
    if (section && !(have.get(id) ?? []).includes(section)) added.push({ cluster_id: id, topic_id: section, relevance: 1 });
  }
  for (const [topic, ids] of removed) {
    await inChunks(ids, 200, async (chunk) => {
      check(await db.from('cluster_topics').delete().eq('topic_id', topic).in('cluster_id', chunk), 'cluster_topics news delete');
    });
  }
  await inChunks(added, 500, async (chunk) => {
    check(await db.from('cluster_topics').upsert(chunk, { onConflict: 'cluster_id,topic_id' }), 'cluster_topics news insert');
  });

  const bySection = Object.fromEntries(NEWS_IDS.map((t) => [t, [...want.values()].filter((s) => s === t).length]));
  const removedCount = [...removed.values()].reduce((n, ids) => n + ids.length, 0);
  ctx.stats.headlines = { checked: clusters.length, headlines: want.size, added: added.length, removed: removedCount, bySection };
  ctx.log(
    `headlines: 묶음 ${clusters.length}개 중 헤드라인 ${want.size}개(새로 ${added.length} · 뺌 ${removedCount}) ` +
      NEWS_SECTIONS.map((t) => `${t.name} ${bySection[t.id]}`).join(' · '),
  );
}
