import { db, check, inChunks } from '../lib/db';
import { parseFeed, type FeedEntry } from '../lib/feed';
import { fetchText } from '../lib/http';
import { mapLimit } from '../lib/limit';
import { clip } from '../lib/text';
import { canonicalUrl } from '../lib/url';
import { HOUR, type Ctx } from '../lib/ctx';
import { SOURCES } from '../sources';

interface SourceRow {
  id: number;
  kind: 'rss' | 'youtube' | 'hn';
  url: string;
  name: string;
  lang: 'ko' | 'en';
  fail_count: number;
}

/** 1. collect: 출처 피드에서 창(기본 72시간) 안의 새 글을 items에 넣는다. 같은 주소는 한 번만 */
export async function collect(ctx: Ctx) {
  check(
    await db.from('sources').upsert(SOURCES.map(({ kind, url, name, weight, lang }) => ({ kind, url, name, weight, lang })), { onConflict: 'url' }),
    'sources upsert',
  );
  const sources = check(await db.from('sources').select('id,kind,url,name,lang,fail_count').eq('active', true), 'sources') as SourceRow[];
  const since = ctx.now.getTime() - ctx.windowHours * HOUR;
  const failed: string[] = [];

  const perSource = await mapLimit(sources, 8, async (s) => {
    try {
      const xml = await fetchText(s.url, { attempts: s.kind === 'youtube' ? 4 : 2, maxBytes: 20_000_000 });
      const entries = parseFeed(xml, s.lang);
      // 날짜 없는 피드는 맨 앞 3개만 본다(처음 볼 때 옛 글이 한꺼번에 들어오지 않게)
      let undated = 0;
      const fresh = entries.filter((e) => (e.publishedAt ? e.publishedAt.getTime() >= since : undated++ < 3));
      await db.from('sources').update({ last_ok_at: ctx.now.toISOString(), fail_count: 0, last_error: null }).eq('id', s.id);
      return fresh.map((entry) => ({ source: s, entry }));
    } catch (e) {
      failed.push(`${s.name}: ${String((e as Error).message ?? e).slice(0, 80)}`);
      await db.from('sources').update({ fail_count: s.fail_count + 1, last_error: String((e as Error).message ?? e).slice(0, 300) }).eq('id', s.id);
      return [];
    }
  });

  const byUrl = new Map<string, { source: SourceRow; entry: FeedEntry }>();
  for (const { source, entry } of perSource.flat()) {
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
  }));
  await inChunks(rows, 200, async (chunk) => {
    check(await db.from('items').upsert(chunk, { onConflict: 'canonical_url', ignoreDuplicates: true }), 'items insert');
  });

  ctx.stats.collect = { sources: sources.length, failed: failed.length, entries: byUrl.size, inserted: rows.length };
  ctx.log(`collect: 출처 ${sources.length}곳(실패 ${failed.length}) · 글 ${byUrl.size}개 중 새 글 ${rows.length}개`);
  for (const f of failed) ctx.log(`  수집 실패 ${f}`);
}
