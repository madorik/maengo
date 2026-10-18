import { createGeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import {
  blockedHost, COMMON_FEED_PATHS, isHttpInput, feedLinksInHtml, feedUrlKey, guessLang, isUnsafeLinkUrl, looksLikeFeedUrl, normalizeLinkInput, platformFeedUrls, type LinkError,
} from '@maengo/core/topics';
import { cluster } from './jobs/cluster';
import { storeEntries, type SourceRow } from './jobs/collect';
import { embedItems } from './jobs/embed';
import { tagLinks } from './jobs/tag';
import { aiBlockedReason, guardAi } from './lib/ai-guard';
import { HOUR, type Ctx } from './lib/ctx';
import { check, db } from './lib/db';
import { env } from './lib/env';
import { feedTitle, freshEntries, isFeedXml, latestOf, LINK_MAX_PER_FETCH, parseFeed, type FeedEntry } from './lib/feed';
import { USER_AGENT } from './lib/http';
import { tryLock, unlock } from './lib/lock';
import { BlockedAddressError, safeGet } from './lib/safe-http';
import { flushUsage, recordUsage } from './lib/usage';

// 내 관심 링크(설정 > 관심사, Premium): 사용자가 적은 주소에서 RSS를 찾아 확인하고(resolveLink), 넣은 자리에서 최근 글을 바로 처리한다(ingestLinkNow).
// 이 뒤로는 보통 출처와 같다: 하루 한 번(06:00) collect가 받고(custom 출처는 한 번에 LINK_MAX_PER_FETCH개), tagLinks가 묶음에 's-<id>' 토픽을 붙인다.
// 주소 규칙(막는 곳·플랫폼별 피드 주소·사설 주소)은 core topics/links.ts. 유튜브는 받지 않는다(2026-10-15 사용자 결정).

export interface ResolvedLink {
  /** sources.url(피드 주소, feedUrlKey로 정리) */
  feedUrl: string;
  /** 사용자가 넣은 사이트 주소(설정 목록에서 여는 곳) */
  siteUrl: string;
  name: string;
  lang: 'ko' | 'en';
  entries: FeedEntry[];
}

export type ResolveResult = { ok: true; link: ResolvedLink } | { ok: false; error: LinkError };

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 5;
/** 한 주소에서 피드를 찾느라 열어 보는 횟수 상한(플랫폼 규칙 + 페이지의 link 태그 + 흔한 경로) */
const MAX_ATTEMPTS = 10;

class HostError extends Error {
  constructor(public readonly reason: LinkError) {
    super(reason);
  }
}

function hostCheck(u: URL): void {
  const blocked = blockedHost(u.hostname);
  if (blocked) throw new HostError(blocked);
  if (isUnsafeLinkUrl(u)) throw new HostError('private');
}

/**
 * 사용자 주소를 가져온다. https만, 리다이렉트는 손으로 따라가며 옮겨 간 호스트도 같은 검사를 한다(막는 곳·주소 모양).
 * 실제로 연결할 IP가 사설·예약 대역이면 연결하지 않는다(safe-http). 크기·시간 제한. 실패하면 던진다
 */
async function fetchUser(url: string): Promise<{ text: string; url: string }> {
  try {
    return await safeGet(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5' },
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      maxRedirects: MAX_REDIRECTS,
      httpsOnly: true,
      check: hostCheck,
    });
  } catch (e) {
    if (e instanceof BlockedAddressError) throw new HostError('private');
    throw e;
  }
}

/**
 * 주소에서 피드를 찾는다. 차례: 주소가 이미 피드 → 플랫폼 규칙(티스토리·벨로그 등) → 페이지의 <link rel="alternate"> → 흔한 경로(/feed, /rss …).
 * 글이 하나라도 있는 피드를 처음 찾으면 끝. 피드는 맞는데 글이 없으면 'empty', 못 찾으면 'nofeed', 페이지도 못 열면 'unreachable'
 */
export async function resolveLink(raw: string): Promise<ResolveResult> {
  if (isHttpInput(raw)) return { ok: false, error: 'http' };
  const u = normalizeLinkInput(raw);
  if (!u) return { ok: false, error: 'invalid' };
  try {
    hostCheck(u);
  } catch (e) {
    return { ok: false, error: (e as HostError).reason };
  }

  const tried = new Set<string>();
  let sawEmpty = false;
  let unreachable = false;
  const tryFeed = async (candidate: string): Promise<ResolvedLink | null> => {
    if (tried.size >= MAX_ATTEMPTS || tried.has(candidate)) return null;
    tried.add(candidate);
    let got: { text: string; url: string };
    try {
      got = await fetchUser(candidate);
    } catch (e) {
      if (e instanceof HostError) throw e;
      return null;
    }
    if (!isFeedXml(got.text)) return null;
    const title = feedTitle(got.text);
    const lang = guessLang([title, ...parseFeed(got.text, 'ko').slice(0, 5).map((e) => e.title)]);
    const entries = parseFeed(got.text, lang);
    if (!entries.length) {
      sawEmpty = true;
      return null;
    }
    return { feedUrl: feedUrlKey(got.url), siteUrl: u.toString(), name: (title || u.hostname).slice(0, 60), lang, entries };
  };

  try {
    // 1. 주소가 이미 피드이거나, 플랫폼마다 정해진 피드 주소
    const first = [...(looksLikeFeedUrl(u) ? [u.toString()] : []), ...platformFeedUrls(u)];
    for (const c of first) {
      const link = await tryFeed(c);
      if (link) return { ok: true, link };
    }
    // 2. 페이지를 열어 <link rel="alternate">. 페이지 자체가 피드일 수도 있다
    let html = '';
    try {
      const page = await fetchUser(u.toString());
      html = page.text;
      if (isFeedXml(html)) {
        const link = await tryFeed(page.url);
        if (link) return { ok: true, link };
      }
    } catch (e) {
      if (e instanceof HostError) throw e;
      unreachable = true;
    }
    for (const c of feedLinksInHtml(html, u.toString())) {
      const link = await tryFeed(c);
      if (link) return { ok: true, link };
    }
    // 3. 흔한 경로: 넣은 경로 아래와 사이트 루트
    const bases = [u.toString().replace(/\/[^/]*$/, '/'), `${u.origin}/`];
    for (const base of [...new Set(bases)]) {
      for (const path of COMMON_FEED_PATHS) {
        const link = await tryFeed(new URL(path, base).toString());
        if (link) return { ok: true, link };
      }
    }
  } catch (e) {
    if (e instanceof HostError) return { ok: false, error: e.reason };
    throw e;
  }
  if (sawEmpty) return { ok: false, error: 'empty' };
  return { ok: false, error: unreachable ? 'unreachable' : 'nofeed' };
}

const LOCK = 'pipeline:link';
const LOCK_STALE_MS = 4 * 60_000;

function makeCtx(): Ctx {
  const log = (m: string) => console.log(`[link] ${m}`);
  const now = new Date();
  return {
    date: kstDate(now),
    now,
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log })),
    log,
    stats: {},
    force: false,
    windowHours: 72,
  };
}

/**
 * 링크를 넣은 자리에서: 창(72시간) 안의 글을 items에 넣고(최신 LINK_MAX_PER_FETCH개까지), 그 글만 임베딩 → 묶기 → 링크 태그.
 * 그래야 '하나 더 받기'와 다음 지급에 바로 후보가 된다. AI가 막혀 있으면 넣기만 하고(하루 한 번 도는 ingest가 처리한다),
 * 다른 요청이 처리 중이면(잠금) 그냥 둔다. 실패해도 링크 넣기는 이미 끝났으므로 기록만 남긴다
 */
export async function ingestLinkNow(source: { id: number; url: string; name: string; lang: 'ko' | 'en'; custom: boolean }, entries: FeedEntry[]): Promise<void> {
  const ctx = makeCtx();
  const lock = await tryLock(LOCK, LOCK_STALE_MS);
  if (!lock) {
    ctx.log(`${source.name}: 다른 요청이 처리 중이라 다음 수집에 맡김`);
    return;
  }
  try {
    const row: SourceRow = { id: source.id, kind: 'rss', url: source.url, name: source.name, lang: source.lang, fail_count: 0, custom: source.custom };
    const since = ctx.now.getTime() - ctx.windowHours * HOUR;
    const fresh = freshEntries(entries, since, source.custom ? LINK_MAX_PER_FETCH : Infinity);
    const { inserted, insertedIds } = await storeEntries(ctx, fresh.map((entry) => ({ source: row, entry })));
    const latest = latestOf(entries);
    await db.from('sources').update({ last_ok_at: ctx.now.toISOString(), fail_count: 0, last_error: null, ...(latest ? { last_item_at: latest } : {}) }).eq('id', source.id);
    ctx.log(`${source.name}: 창 안의 글 ${fresh.length}개 중 새 글 ${inserted}개`);
    if (insertedIds.length && !(await aiBlockedReason())) {
      const items = check(await db.from('items').select('id,title,excerpt').in('id', insertedIds), 'items new') as { id: number; title: string; excerpt: string | null }[];
      await embedItems(ctx, items);
      await cluster(ctx);
    }
    await tagLinks(ctx);
  } catch (e) {
    ctx.log(`${source.name}: 처리 실패(다음 수집이 잇는다): ${String((e as Error).message ?? e).slice(0, 200)}`);
  } finally {
    await unlock(LOCK, lock);
    await flushUsage();
  }
}
