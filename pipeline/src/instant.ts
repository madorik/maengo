import { createGeminiAi } from '@maengo/core/gemini';
import { rankFeed } from '@maengo/core/feed';
import { kstDate } from '@maengo/core/kst';
import { groupOf, isNewsSection } from '@maengo/core/topics';
import { db, check } from './lib/db';
import { tryLock, unlock, waitUnlock } from './lib/lock';
import { env } from './lib/env';
import { mapLimit } from './lib/limit';
import { dictionary, loadAudience, loadCandidates, withSimilarExcluded, type Audience } from './lib/audience';
import { flushUsage, recordUsage } from './lib/usage';
import { SECTION_BY_SOURCE_URL } from './lib/headline';
import { HOUR, type Ctx } from './lib/ctx';
import { cluster } from './jobs/cluster';
import { collect } from './jobs/collect';
import { embedItems } from './jobs/embed';
import { summarizeCluster } from './jobs/summarize';
import { tag } from './jobs/tag';

// "오늘 맹고 받기"(웹): 새벽 배치를 기다리지 않고 이 유저 한 명의 오늘 피드를 지금 만든다.
// 이미 모아 둔 소식(수집·임베딩·태그는 배치가 해 둠) 중 관심사에 맞는 것을 고르고, 요약이 없는 것만 그 자리에서 요약한다.
// 처음 가입해 오늘 피드가 비었을 때 쓴다. 요약은 한 번에 최대 maxSummaries개(시간·비용 상한).
// 고를 소식이 거의 없으면(새 관심사, 배치 전에 들어온 글) 최근 글을 지금 처리해 후보를 만든다(prepareFresh).
// 그래도 없으면 상세 관심사를 큰 분류까지 넓혀 고른다(코스피 → 주식).

export type InstantProgress =
  | { stage: 'finding' }
  | { stage: 'collecting' }
  /** 고른 소식 중 이미 요약된 것(ready)과 지금 요약할 것(toMake) */
  | { stage: 'found'; ready: number; toMake: number }
  | { stage: 'summarizing'; done: number; total: number }
  | { stage: 'saving' }
  | { stage: 'done'; items: number }
  | { stage: 'empty' };

export async function buildTodayFeedNow(
  userId: string,
  onProgress: (p: InstantProgress) => void,
  { maxSummaries = 5 }: { maxSummaries?: number } = {},
): Promise<number> {
  const ctx: Ctx = {
    date: kstDate(),
    now: new Date(),
    ai: createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log: (m) => console.log(`[instant] ${m}`) }),
    log: (m) => console.log(`[instant] ${m}`),
    stats: {},
    force: true,
    windowHours: 72,
  };
  onProgress({ stage: 'finding' });
  const [a] = await loadAudience(ctx, userId);
  if (!a) {
    onProgress({ stage: 'empty' });
    return 0;
  }
  let candidates = await loadCandidates(ctx, { centroids: a.known.length > 0 });
  let exclude = await withSimilarExcluded(a, candidates);
  const want = a.dailyItems;
  let weights = a.weights;
  let picked = rankFeed(candidates, weights, exclude, { limit: want });
  if (picked.length < Math.min(want, 3)) {
    onProgress({ stage: 'collecting' });
    await prepareFresh(ctx, a);
    candidates = await loadCandidates(ctx, { centroids: a.known.length > 0 });
    exclude = await withSimilarExcluded(a, candidates);
    picked = rankFeed(candidates, weights, exclude, { limit: want });
  }
  if (!picked.length) {
    weights = widenToGroups(a.weights);
    picked = rankFeed(candidates, weights, exclude, { limit: want });
    if (picked.length) ctx.log(`관심사에 맞는 소식이 없어 큰 분류까지 넓혀 ${picked.length}개 고름`);
  }
  const toSummarize = picked.filter((r) => !candidates.find((c) => c.id === r.clusterId)!.summarized).slice(0, maxSummaries);
  if (picked.length) onProgress({ stage: 'found', ready: picked.length - picked.filter((r) => !candidates.find((c) => c.id === r.clusterId)!.summarized).length, toMake: toSummarize.length });

  if (toSummarize.length) {
    let done = 0;
    onProgress({ stage: 'summarizing', done, total: toSummarize.length });
    await mapLimit(toSummarize, 3, async (r) => {
      try {
        await summarizeCluster(ctx, r.clusterId, 'basic', { videos: 0 });
      } catch (e) {
        ctx.log(`요약 실패 #${r.clusterId}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
      onProgress({ stage: 'summarizing', done: ++done, total: toSummarize.length });
    });
    await flushUsage();
  }

  // 요약이 끝난 것만으로 다시 고른다(요약하면서 토픽이 바뀌거나 소식이 아니라고 빠질 수 있어서)
  onProgress({ stage: 'saving' });
  candidates = (await loadCandidates(ctx, { centroids: false })).filter((c) => c.summarized);
  const ranked = rankFeed(candidates, weights, exclude, { limit: 10 });
  check(await db.from('feeds').delete().eq('user_id', userId).eq('date', ctx.date), 'feeds delete');
  check(await db.from('feed_days').delete().eq('user_id', userId).eq('date', ctx.date), 'feed_days delete');
  if (!ranked.length) {
    onProgress({ stage: 'empty' });
    return 0;
  }
  check(
    await db.from('feeds').insert(ranked.map((r, i) => ({ user_id: userId, date: ctx.date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }))),
    'feeds insert',
  );
  const visible = Math.min(ranked.length, a.dailyItems);
  check(await db.from('feed_days').insert({ user_id: userId, date: ctx.date, visible, built_by: 'web' }), 'feed_days insert');
  onProgress({ stage: 'done', items: visible });
  return visible;
}

const FRESH_LOCK = 'pipeline:fresh';
const FRESH_LOCK_STALE = 4 * 60_000;
/** 마지막 수집이 이보다 오래됐으면 지금 다시 모은다 */
const COLLECT_AFTER = 3 * HOUR;
/** 한 번에 임베딩할 글 수. Gemini 무료 등급 임베딩은 글 하나를 요청 하나로 세어 분당 100개쯤이 한도다 */
const FRESH_MAX_ITEMS = 50;

/**
 * 이 사람 관심사에 맞을 최근 글을 지금 처리한다: (오래됐으면) 수집 → 관심사 이름·별칭이 들어간 글(뉴스 분야는 그 분야 섹션 피드 글)만 임베딩 → 묶기 → 태그.
 * 처리 안 된 글 전체는 새벽 배치가 한다(무료 등급 임베딩 한도 때문에 화면에서 기다릴 수 없다). LLM 요약은 여기서 하지 않는다.
 * 여러 사람이 동시에 누르면 한 서버만 하고 나머지는 끝나기를 기다렸다 고른다.
 */
export async function prepareFresh(base: Ctx, a: Audience, { collectAfter = COLLECT_AFTER }: { collectAfter?: number } = {}) {
  // 이미 태그한 묶음은 다시 태그하지 않는다(즉석 피드의 force는 오늘 피드를 다시 만든다는 뜻이라 여기선 끈다)
  const ctx: Ctx = { ...base, force: false };
  if (!(await tryLock(FRESH_LOCK, FRESH_LOCK_STALE))) {
    ctx.log('다른 요청이 최근 글을 처리하는 중이라 기다림');
    await waitUnlock(FRESH_LOCK, FRESH_LOCK_STALE);
    return;
  }
  try {
    const { data } = await db.from('items').select('fetched_at').order('fetched_at', { ascending: false }).limit(1);
    const newest = data?.[0] ? Date.parse((data[0] as { fetched_at: string }).fetched_at) : 0;
    if (ctx.now.getTime() - newest > collectAfter) await collect(ctx);

    const mine = new Set(Object.keys(a.weights));
    const words = (await dictionary(ctx))
      .filter((t) => !isNewsSection(t.id) && (mine.has(t.id) || (t.parent && mine.has(t.parent))))
      .flatMap((t) => [t.name, ...t.aliases]);
    const hits = matcher(words);
    // 뉴스 분야는 낱말 대신 그 분야 섹션 피드의 글을 처리한다(헤드라인은 언론사 여럿의 기사가 한 묶음에 모여야 한다)
    const sections = new Set([...mine].filter(isNewsSection));
    const sectionSources = new Set<number>();
    if (sections.size) {
      const rows = check(await db.from('sources').select('id,url'), 'sources') as { id: number; url: string }[];
      for (const r of rows) if (sections.has(SECTION_BY_SOURCE_URL.get(r.url) ?? '')) sectionSources.add(r.id);
    }
    const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
    const fresh = check(
      await db.from('items').select('id,title,excerpt,source_id').is('embedding', null).gte('fetched_at', since).order('published_at', { ascending: false }).limit(2000),
      'items fresh',
    ) as { id: number; title: string; excerpt: string | null; source_id: number | null }[];
    const todo = fresh
      .filter((i) => hits(`${i.title} ${i.excerpt ?? ''}`) || sectionSources.has(i.source_id ?? -1))
      .slice(0, FRESH_MAX_ITEMS)
      .map(({ id, title, excerpt }) => ({ id, title, excerpt }));
    ctx.log(`최근 글 ${fresh.length}개 중 관심사 단어가 들었거나 고른 뉴스 분야의 글 ${todo.length}개를 먼저 처리`);
    if (todo.length) await embedItems(ctx, todo);
    await cluster(ctx);
    await tag(ctx);
  } finally {
    await unlock(FRESH_LOCK);
  }
}

/** 글에 관심사 단어가 들었는지. 영문은 낱말 단위로(AI가 said에 걸리지 않게), 한글은 그대로 찾는다 */
function matcher(words: string[]): (text: string) => boolean {
  const ascii: RegExp[] = [];
  const other: string[] = [];
  for (const w of new Set(words.map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 2))) {
    if (/^[\x00-\x7f]+$/.test(w)) ascii.push(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`));
    else other.push(w);
  }
  return (text) => {
    const t = text.toLowerCase();
    return other.some((w) => t.includes(w)) || ascii.some((r) => r.test(t));
  };
}

/** 상세 관심사의 큰 분류를 절반 가중치로 더한다(이미 고른 큰 분류는 그대로). 직접 적은 관심사는 큰 분류가 없다 */
export function widenToGroups(weights: Record<string, number>): Record<string, number> {
  const out = { ...weights };
  for (const [id, w] of Object.entries(weights)) {
    const g = groupOf(id);
    if (g !== id && !(g in out)) out[g] = w * 0.5;
  }
  return out;
}
