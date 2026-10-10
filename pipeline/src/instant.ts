import { createGeminiAi } from '@maengo/core/gemini';
import { rankFeed } from '@maengo/core/feed';
import { kstDate } from '@maengo/core/kst';
import { db, check } from './lib/db';
import { env } from './lib/env';
import { mapLimit } from './lib/limit';
import { loadAudience, loadCandidates, withSimilarExcluded } from './lib/audience';
import { flushUsage, recordUsage } from './lib/usage';
import type { Ctx } from './lib/ctx';
import { summarizeCluster } from './jobs/summarize';

// "오늘 맹고 받기"(웹): 새벽 배치를 기다리지 않고 이 유저 한 명의 오늘 피드를 지금 만든다.
// 이미 모아 둔 소식(수집·임베딩·태그는 배치가 해 둠) 중 관심사에 맞는 것을 고르고, 요약이 없는 것만 그 자리에서 요약한다.
// 처음 가입해 오늘 피드가 비었을 때 쓴다. 요약은 한 번에 최대 maxSummaries개(시간·비용 상한).

export type InstantProgress =
  | { stage: 'finding' }
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
  const exclude = await withSimilarExcluded(a, candidates);
  const want = a.dailyItems;
  const picked = rankFeed(candidates, a.weights, exclude, { limit: want });
  const toSummarize = picked.filter((r) => !candidates.find((c) => c.id === r.clusterId)!.summarized).slice(0, maxSummaries);

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
  const ranked = rankFeed(candidates, a.weights, exclude, { limit: 10 });
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
