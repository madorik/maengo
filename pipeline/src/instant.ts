import { createGeminiAi } from '@maengo/core/gemini';
import { linkCap, rankFeed, type RankedItem } from '@maengo/core/feed';
import { kstDate } from '@maengo/core/kst';
import { db, check } from './lib/db';
import { aiBlockedReason, guardAi, isAiBlocked } from './lib/ai-guard';
import { tryLock, unlock, waitUnlock } from './lib/lock';
import { env } from './lib/env';
import { mapLimit } from './lib/limit';
import { loadAudience, loadCandidates, summarizable, withSimilarExcluded, type Audience } from './lib/audience';
import { flushUsage, recordUsage } from './lib/usage';
import { interestFilter } from './lib/interest';
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
// 고른 관심사에 맞는 소식만 준다. 모자라면 모자란 대로(상세 관심사를 큰 분류로 넓히지 않는다: 코스피만 골랐으면 주식 전체는 주지 않는다, 2026-10-22 사용자 결정).

export type InstantProgress =
  | { stage: 'finding' }
  | { stage: 'collecting' }
  /** 고른 소식 중 이미 요약된 것(ready)과 지금 요약할 것(toMake) */
  | { stage: 'found'; ready: number; toMake: number }
  | { stage: 'summarizing'; done: number; total: number }
  | { stage: 'saving' }
  | { stage: 'done'; items: number }
  | { stage: 'empty' }
  /** AI가 막혀(크레딧 소진·지출 상한) 새로 만들 수 없고, 이미 요약된 소식 중에도 고를 게 없다 */
  | { stage: 'blocked' };

export async function buildTodayFeedNow(
  userId: string,
  onProgress: (p: InstantProgress) => void,
  { maxSummaries = 5 }: { maxSummaries?: number } = {},
): Promise<number> {
  const ctx: Ctx = {
    date: kstDate(),
    now: new Date(),
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log: (m) => console.log(`[instant] ${m}`) })),
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
  // 요약 안 된 영상은 여기서 요약하지 않으니(videos: 0) 후보에서 뺀다
  let candidates = (await loadCandidates(ctx, { centroids: a.known.length > 0 })).filter(summarizable);
  let exclude = await withSimilarExcluded(a, candidates);
  const want = a.dailyItems;
  const maxLinks = linkCap(want);
  const weights = a.weights;
  let picked = rankFeed(candidates, weights, exclude, { limit: want, maxLinks });
  // AI가 막혀 있으면(크레딧 소진·지출 상한) 새로 처리·요약하지 않고, 처리하다 막혀도 이미 요약된 소식으로 계속한다
  let aiBlocked = (await aiBlockedReason()) !== null;
  if (picked.length < Math.min(want, 3) && !aiBlocked) {
    onProgress({ stage: 'collecting' });
    try {
      await prepareFresh(ctx, a);
    } catch (e) {
      if (!isAiBlocked(e)) throw e;
      aiBlocked = true;
      ctx.log(`최근 글 처리 중 AI가 막힘, 있는 소식으로 계속: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
    candidates = (await loadCandidates(ctx, { centroids: a.known.length > 0 })).filter(summarizable);
    exclude = await withSimilarExcluded(a, candidates);
    picked = rankFeed(candidates, weights, exclude, { limit: want, maxLinks });
  }
  const toSummarize = aiBlocked ? [] : picked.filter((r) => !candidates.find((c) => c.id === r.clusterId)!.summarized).slice(0, maxSummaries);
  if (picked.length) onProgress({ stage: 'found', ready: picked.length - picked.filter((r) => !candidates.find((c) => c.id === r.clusterId)!.summarized).length, toMake: toSummarize.length });

  if (toSummarize.length) {
    let done = 0;
    onProgress({ stage: 'summarizing', done, total: toSummarize.length });
    await mapLimit(toSummarize, 3, async (r) => {
      try {
        if (!aiBlocked) await summarizeCluster(ctx, r.clusterId, 'basic', { videos: 0 });
      } catch (e) {
        if (isAiBlocked(e)) aiBlocked = true;
        ctx.log(`요약 실패 #${r.clusterId}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
      onProgress({ stage: 'summarizing', done: ++done, total: toSummarize.length });
    });
    await flushUsage();
  }

  // 요약이 끝난 것만으로 다시 고른다(요약하면서 토픽이 바뀌거나 소식이 아니라고 빠질 수 있어서)
  onProgress({ stage: 'saving' });
  candidates = (await loadCandidates(ctx, { centroids: false })).filter((c) => c.summarized);
  const ranked = rankFeed(candidates, weights, exclude, { limit: 10, maxLinks });
  // 맹고로 더 받은 개수는 새로 만들어도 지킨다
  const prev = (await db.from('feed_days').select('extra').eq('user_id', userId).eq('date', ctx.date).maybeSingle()).data as { extra: number } | null;
  const extra = prev?.extra ?? 0;
  check(await db.from('feeds').delete().eq('user_id', userId).eq('date', ctx.date), 'feeds delete');
  check(await db.from('feed_days').delete().eq('user_id', userId).eq('date', ctx.date), 'feed_days delete');
  if (!ranked.length) {
    onProgress({ stage: aiBlocked ? 'blocked' : 'empty' });
    return 0;
  }
  check(
    await db.from('feeds').insert(ranked.map((r, i) => ({ user_id: userId, date: ctx.date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }))),
    'feeds insert',
  );
  const visible = Math.min(ranked.length, a.dailyItems + extra);
  check(await db.from('feed_days').insert({ user_id: userId, date: ctx.date, visible, extra, built_by: 'web' }), 'feed_days insert');
  onProgress({ stage: 'done', items: visible });
  return visible;
}

/** '하나 더 받기'가 찾아보는 기간: 최근 한 달 */
const MORE_WINDOW_HOURS = 30 * 24;

/**
 * '하나 더 받기'(웹)에서 요약된 소식이 다 떨어졌을 때: 최근 한 달 안에 모아 둔 묶음 중 이 사람 관심사에 맞고
 * 준 적 없는 것(지난 피드·읽음·싫어요·비슷한 것 빼고, alsoExclude도 빼고)을 골라 지금 요약해서 돌려준다.
 * 이미 요약된 게 걸리면 그대로 준다. AI가 막혀 있으면 'blocked', 맞는 게 없으면 'none'. 요약은 많아야 3번 시도한다.
 */
export async function makeOneMore(userId: string, alsoExclude: number[]): Promise<{ clusterId: number; topicId: string } | 'none' | 'blocked'> {
  const log = (m: string) => console.log(`[more] ${m}`);
  const ctx: Ctx = {
    date: kstDate(),
    now: new Date(),
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log })),
    log,
    stats: {},
    force: false,
    windowHours: MORE_WINDOW_HOURS,
  };
  const [a] = await loadAudience(ctx, userId);
  if (!a) return 'none';
  const candidates = (await loadCandidates(ctx, { centroids: a.known.length > 0, sinceHours: MORE_WINDOW_HOURS })).filter(summarizable);
  const exclude = await withSimilarExcluded(a, candidates);
  for (const id of alsoExclude) exclude.add(id);
  const picked = rankFeed(candidates, a.weights, exclude, { limit: 3 });
  try {
    for (const r of picked) {
      if (candidates.find((c) => c.id === r.clusterId)?.summarized) return { clusterId: r.clusterId, topicId: r.topicId };
      if (await aiBlockedReason()) return 'blocked';
      try {
        if ((await summarizeCluster(ctx, r.clusterId, 'basic', { videos: 0 })) === 'ok') {
          log(`한 달 안의 소식 #${r.clusterId}를 지금 요약해 줌`);
          return { clusterId: r.clusterId, topicId: r.topicId };
        }
      } catch (e) {
        if (isAiBlocked(e)) return 'blocked';
        log(`요약 실패 #${r.clusterId}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
    }
    return 'none';
  } finally {
    await flushUsage();
  }
}

/** 남은 소식을 채울 때 '소식 아님'으로 빠지는 것에 대비해 더 골라 두는 수 */
const FILL_SPARE = 3;
/** 남은 소식을 채울 때 동시에 요약하는 수 */
const FILL_CONCURRENCY = 3;

/**
 * '남은 소식 더 받기'(웹, api/feed/today/fill): 오늘 보여 주는 소식이 오늘 받을 수 있는 수(want = 하루 소식 + 맹고로 더 받은 수)보다 적을 때
 * 모자란 만큼 지금 채운다. 배송이 적게 준 날(후보가 모자랐던 날 등)에 쓴다. 오늘 받은 소식은 그대로 두고 뒤에 붙인다(지우지 않는다).
 * 오늘 골라 두고 안 보여 준 소식이 있으면 그것부터 보여 주고, 모자라면 최근 한 달 안의 묶음에서 골라(요약 안 된 영상은 뺀다)
 * 요약이 없는 것은 지금 요약한다. AI가 막혀 있으면 이미 요약된 것만. 돌려주는 값 = 새로 보여 주게 된 소식 수
 */
export async function fillTodayFeedNow(userId: string, want: number, onProgress: (p: InstantProgress) => void): Promise<number> {
  const log = (m: string) => console.log(`[fill] ${m}`);
  const ctx: Ctx = {
    date: kstDate(),
    now: new Date(),
    ai: guardAi(createGeminiAi({ apiKey: env.geminiKey, fallbackModel: env.geminiFallback, onUsage: recordUsage, log })),
    log,
    stats: {},
    force: false,
    windowHours: MORE_WINDOW_HOURS,
  };
  onProgress({ stage: 'finding' });
  const day = check(await db.from('feed_days').select('visible,extra').eq('user_id', userId).eq('date', ctx.date).maybeSingle(), 'feed_days') as { visible: number; extra: number } | null;
  const rows = check(await db.from('feeds').select('rank,cluster_id').eq('user_id', userId).eq('date', ctx.date).order('rank'), 'feeds') as { rank: number; cluster_id: number }[];
  if (!day || !rows.length || day.visible >= want) {
    onProgress({ stage: 'empty' });
    return 0;
  }
  let added = 0;
  let aiBlocked = false;
  const need = want - rows.length;
  if (need > 0) {
    const [a] = await loadAudience(ctx, userId);
    if (!a) {
      onProgress({ stage: 'empty' });
      return 0;
    }
    const candidates = (await loadCandidates(ctx, { centroids: a.known.length > 0, sinceHours: MORE_WINDOW_HOURS })).filter(summarizable);
    const exclude = await withSimilarExcluded(a, candidates);
    for (const r of rows) exclude.add(r.cluster_id);
    const opts = { limit: need + FILL_SPARE, maxLinks: linkCap(a.dailyItems) };
    const picked = rankFeed(candidates, a.weights, exclude, opts);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    aiBlocked = (await aiBlockedReason()) !== null;
    const got: RankedItem[] = picked.filter((r) => byId.get(r.clusterId)!.summarized).slice(0, need);
    const toMake = aiBlocked ? [] : picked.filter((r) => !byId.get(r.clusterId)!.summarized);
    onProgress({ stage: 'found', ready: got.length, toMake: Math.min(toMake.length, need - got.length) });
    if (got.length < need && toMake.length) {
      const total = Math.min(toMake.length, need - got.length);
      let done = 0;
      onProgress({ stage: 'summarizing', done, total });
      // 위에서부터 요약해 모자란 만큼 모은다. '소식 아님'으로 빠지면 다음 것으로 채운다
      for (let i = 0; i < toMake.length && got.length < need && !aiBlocked; ) {
        const batch = toMake.slice(i, i + (need - got.length));
        i += batch.length;
        const ok = await mapLimit(batch, FILL_CONCURRENCY, async (r) => {
          try {
            if (aiBlocked) return false;
            return (await summarizeCluster(ctx, r.clusterId, 'basic', { videos: 0 })) === 'ok';
          } catch (e) {
            if (isAiBlocked(e)) aiBlocked = true;
            log(`요약 실패 #${r.clusterId}: ${String((e as Error).message ?? e).slice(0, 160)}`);
            return false;
          } finally {
            done = Math.min(total, done + 1);
            onProgress({ stage: 'summarizing', done, total });
          }
        });
        batch.forEach((r, k) => ok[k] && got.push(r));
      }
      await flushUsage();
    }
    if (got.length) {
      onProgress({ stage: 'saving' });
      let rank = rows.at(-1)!.rank;
      check(
        await db.from('feeds').insert(got.map((r) => ({ user_id: userId, date: ctx.date, rank: ++rank, cluster_id: r.clusterId, topic_id: r.topicId }))),
        'feeds insert',
      );
      added = got.length;
      // byId의 summarized는 고를 때 값이라(요약해도 바꾸지 않는다) 지금 새로 요약한 수가 된다
      log(`오늘 소식 ${added}개를 더 붙임(지금 요약 ${got.filter((r) => !byId.get(r.clusterId)!.summarized).length}개)`);
    }
  }
  const visible = Math.min(rows.length + added, want);
  const shown = visible - day.visible;
  if (shown <= 0) {
    onProgress({ stage: aiBlocked ? 'blocked' : 'empty' });
    return 0;
  }
  check(await db.from('feed_days').update({ visible }).eq('user_id', userId).eq('date', ctx.date), 'feed_days visible');
  onProgress({ stage: 'done', items: shown });
  return shown;
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
  const lock = await tryLock(FRESH_LOCK, FRESH_LOCK_STALE);
  if (!lock) {
    ctx.log('다른 요청이 최근 글을 처리하는 중이라 기다림');
    await waitUnlock(FRESH_LOCK, FRESH_LOCK_STALE);
    return;
  }
  try {
    const { data } = await db.from('items').select('fetched_at').order('fetched_at', { ascending: false }).limit(1);
    const newest = data?.[0] ? Date.parse((data[0] as { fetched_at: string }).fetched_at) : 0;
    if (ctx.now.getTime() - newest > collectAfter) await collect(ctx);

    const wanted = await interestFilter(ctx, new Set(Object.keys(a.weights)));
    const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
    const fresh = check(
      await db.from('items').select('id,title,excerpt,source_id').is('embedding', null).gte('fetched_at', since).order('published_at', { ascending: false }).limit(2000),
      'items fresh',
    ) as { id: number; title: string; excerpt: string | null; source_id: number | null }[];
    const todo = fresh
      .filter(wanted)
      .slice(0, FRESH_MAX_ITEMS)
      .map(({ id, title, excerpt }) => ({ id, title, excerpt }));
    ctx.log(`최근 글 ${fresh.length}개 중 관심사 단어가 들었거나 고른 뉴스 분야의 글 ${todo.length}개를 먼저 처리`);
    if (todo.length) await embedItems(ctx, todo);
    await cluster(ctx);
    await tag(ctx);
  } finally {
    await unlock(FRESH_LOCK, lock);
  }
}

