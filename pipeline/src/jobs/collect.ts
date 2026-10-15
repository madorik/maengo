import { db, check, inChunks } from '../lib/db';
import { freshEntries, latestOf, LINK_MAX_PER_FETCH, parseFeed, type FeedEntry } from '../lib/feed';
import { fetchText } from '../lib/http';
import { mapLimit } from '../lib/limit';
import { clip } from '../lib/text';
import { canonicalUrl } from '../lib/url';
import { HOUR, type Ctx } from '../lib/ctx';
import { SOURCES } from '../sources';

export interface SourceRow {
  id: number;
  kind: 'rss' | 'youtube' | 'hn';
  url: string;
  name: string;
  lang: 'ko' | 'en';
  fail_count: number;
  /** 내 관심 링크로 들어온 출처(사용자가 넣음). 한 번에 LINK_MAX_PER_FETCH개까지만 받는다 */
  custom: boolean;
}

/**
 * 글을 items에 넣는다. 같은 주소는 한 번만, 이미 있는 글의 조회수·점수는 새 값으로. 새로 들어간 글의 id를 돌려준다
 * (내 관심 링크를 넣는 자리에서 그 글만 바로 임베딩하려고)
 */
export async function storeEntries(ctx: Ctx, pairs: { source: SourceRow; entry: FeedEntry }[]) {
  const byUrl = new Map<string, { source: SourceRow; entry: FeedEntry }>();
  for (const { source, entry } of pairs) {
    let url: string;
    try {
      url = canonicalUrl(entry.url);
    } catch {
      continue;
    }
    if (!byUrl.has(url)) byUrl.set(url, { source, entry });
  }

  const existing = new Set<string>();
  await inChunks([...byUrl.keys()], 50, async (urls) => {
    const rows = check(await db.from('items').select('canonical_url').in('canonical_url', urls), 'items lookup') as { canonical_url: string }[];
    for (const r of rows) existing.add(r.canonical_url);
  });

  const now = ctx.now.getTime();
  const fresh = [...byUrl].filter(([url]) => !existing.has(url));
  const rows = fresh.map(([url, { source, entry }]) => ({
    source_id: source.id,
    canonical_url: url,
    title: clip(entry.title, 300),
    kind: entry.videoId ? 'video' : 'article',
    author: entry.author ? clip(entry.author, 100) : null,
    // 미래 시각(시간대 오류)은 지금으로 자른다
    published_at: new Date(Math.min(entry.publishedAt?.getTime() ?? now, now)).toISOString(),
    // 해커 뉴스 설명은 점수·댓글 링크뿐이라 버린다
    excerpt: source.kind === 'hn' ? null : entry.excerpt || null,
    views: entry.views,
    hn_points: entry.hnPoints,
  }));
  const insertedIds: number[] = [];
  await inChunks(rows, 200, async (chunk) => {
    // 그사이 다른 실행이 넣은 글은 건너뛴다(ignoreDuplicates). select는 실제로 들어간 행만 돌려준다
    const got = check(await db.from('items').upsert(chunk, { onConflict: 'canonical_url', ignoreDuplicates: true }).select('id'), 'items insert') as { id: number }[];
    for (const r of got) insertedIds.push(r.id);
  });

  // 이미 받은 글의 조회수·점수는 시간이 지나며 늘어나므로 새 값으로 바꾼다(유튜브·해커 뉴스만이라 몇십 개)
  const stale = [...byUrl].filter(([url, { entry }]) => existing.has(url) && (entry.views != null || entry.hnPoints != null));
  await mapLimit(stale, 8, async ([url, { entry }]) => {
    check(await db.from('items').update({ views: entry.views, hn_points: entry.hnPoints }).eq('canonical_url', url), 'items popularity');
  });

  return { entries: byUrl.size, inserted: rows.length, insertedIds, popularityUpdated: stale.length };
}

/** 1. collect: 출처 피드에서 창(기본 72시간) 안의 새 글을 items에 넣는다. 같은 주소는 한 번만 */
export async function collect(ctx: Ctx) {
  check(
    await db.from('sources').upsert(SOURCES.map(({ kind, url, name, weight, lang }) => ({ kind, url, name, weight, lang })), { onConflict: 'url' }),
    'sources upsert',
  );
  const sources = check(await db.from('sources').select('id,kind,url,name,lang,fail_count,custom').eq('active', true), 'sources') as SourceRow[];
  const since = ctx.now.getTime() - ctx.windowHours * HOUR;
  const failed: string[] = [];

  const perSource = await mapLimit(sources, 8, async (s) => {
    try {
      const xml = await fetchText(s.url, { attempts: s.kind === 'youtube' ? 4 : 2, maxBytes: 20_000_000 });
      const entries = parseFeed(xml, s.lang);
      const fresh = freshEntries(entries, since, s.custom ? LINK_MAX_PER_FETCH : Infinity);
      const latest = latestOf(entries);
      await db
        .from('sources')
        .update({ last_ok_at: ctx.now.toISOString(), fail_count: 0, last_error: null, ...(latest ? { last_item_at: latest } : {}) })
        .eq('id', s.id);
      return fresh.map((entry) => ({ source: s, entry }));
    } catch (e) {
      failed.push(`${s.name}: ${String((e as Error).message ?? e).slice(0, 80)}`);
      await db.from('sources').update({ fail_count: s.fail_count + 1, last_error: String((e as Error).message ?? e).slice(0, 300) }).eq('id', s.id);
      return [];
    }
  });

  const { entries, inserted, popularityUpdated } = await storeEntries(ctx, perSource.flat());
  ctx.stats.collect = { sources: sources.length, failed: failed.length, entries, inserted, popularityUpdated };
  ctx.log(`collect: 출처 ${sources.length}곳(실패 ${failed.length}) · 글 ${entries}개 중 새 글 ${inserted}개 · 조회수·점수 갱신 ${popularityUpdated}개`);
  for (const f of failed) ctx.log(`  수집 실패 ${f}`);
}
