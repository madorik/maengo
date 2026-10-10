import { rankFeed } from '@maengo/core/feed';
import { GeminiQuotaError } from '@maengo/core/gemini';
import { db, check, inChunks } from '../lib/db';
import { loadAudience, loadCandidates, withSimilarExcluded } from '../lib/audience';
import type { Ctx } from '../lib/ctx';
import { summarizeCluster } from './summarize';

// 8. rank: 유저마다 오늘 피드를 만든다. 랭킹은 늘 10개까지 저장하고, 보여 줄 개수(feed_days.visible)만 플랜으로 정한다.
// 후보는 요약이 끝난 묶음(AI가 붙인 토픽)뿐이다. 플러스·체험 유저의 보이는 소식은 상위 모델 요약도 만든다.
const MAX_DAILY = 10;

export async function rank(ctx: Ctx) {
  const audience = await loadAudience(ctx);
  const candidates = (await loadCandidates(ctx)).filter((c) => c.summarized);
  // 배치가 이미 만든 피드는 건너뛴다. 웹이 임시로 만든 피드(built_by='web')는 새 소식으로 다시 만든다
  const days = check(await db.from('feed_days').select('user_id,built_by').eq('date', ctx.date), 'feed_days') as { user_id: string; built_by: string }[];
  const done = new Set(days.filter((d) => d.built_by === 'pipeline').map((d) => d.user_id));
  const provisional = new Set(days.filter((d) => d.built_by === 'web').map((d) => d.user_id));

  let built = 0;
  let empty = 0;
  const proNeeded = new Set<number>();
  for (const a of audience) {
    if (done.has(a.id) && !ctx.force) continue;
    const exclude = await withSimilarExcluded(a, candidates);
    const ranked = rankFeed(candidates, a.weights, exclude, { limit: MAX_DAILY });
    if (ctx.force || provisional.has(a.id)) {
      check(await db.from('feeds').delete().eq('user_id', a.id).eq('date', ctx.date), 'feeds delete');
      check(await db.from('feed_days').delete().eq('user_id', a.id).eq('date', ctx.date), 'feed_days delete');
    }
    if (!ranked.length) {
      empty++;
      ctx.log(`  ${a.id.slice(0, 8)}: 맞는 소식이 없어 오늘 피드가 비어요`);
      continue;
    }
    check(
      await db.from('feeds').insert(ranked.map((r, i) => ({ user_id: a.id, date: ctx.date, rank: i + 1, cluster_id: r.clusterId, topic_id: r.topicId }))),
      'feeds insert',
    );
    const visible = Math.min(ranked.length, a.dailyItems);
    check(await db.from('feed_days').insert({ user_id: a.id, date: ctx.date, visible }), 'feed_days insert');
    if (a.tier === 'pro') for (const r of ranked.slice(0, visible)) proNeeded.add(r.clusterId);
    built++;
  }

  // 상위 모델 요약(플러스·체험). 할당량이 없으면(무료 등급 키) 기본 요약으로 보여 준다
  const have = new Set<number>();
  await inChunks([...proNeeded], 200, async (ids) => {
    const rows = check(await db.from('summaries').select('cluster_id').eq('tier', 'pro').in('cluster_id', ids), 'pro summaries') as { cluster_id: number }[];
    for (const r of rows) have.add(r.cluster_id);
  });
  const proTodo = [...proNeeded].filter((id) => !have.has(id));
  let proOk = 0;
  let proNote = '';
  for (const id of proTodo) {
    try {
      if ((await summarizeCluster(ctx, id, 'pro', { videos: 1 })) === 'ok') proOk++;
    } catch (e) {
      if (e instanceof GeminiQuotaError) {
        proNote = `상위 모델(${e.model}) 할당량 없음 → 기본 요약으로 보여 줌`;
        break;
      }
      ctx.log(`  상위 모델 요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  }

  ctx.stats.rank = { users: audience.length, built, empty, candidates: candidates.length, proTodo: proTodo.length, proOk, proNote };
  ctx.log(`rank: 유저 ${audience.length}명 중 ${built}명 피드 생성(빈 피드 ${empty}) · 후보 ${candidates.length}개`);
  if (proTodo.length) ctx.log(`rank: 상위 모델 요약 ${proOk}/${proTodo.length}${proNote ? ` · ${proNote}` : ''}`);
}
