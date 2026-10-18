import { linkCap, rankFeed } from '@maengo/core/feed';
import { db, check } from '../lib/db';
import { loadAudience, loadCandidates, withSimilarExcluded } from '../lib/audience';
import type { Ctx } from '../lib/ctx';

/** 지금부터 30분 뒤의 KST 시각('HH:MM'). 알림 시각이 이보다 이르거나 같으면 오늘 피드를 만들 때가 됐다. 자정을 넘기면 23:59 */
export function dueClock(now: Date): string {
  const clock = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(11, 16);
  const soon = clock(new Date(now.getTime() + 30 * 60_000));
  return soon < clock(now) ? '23:59' : soon;
}

// 8. rank: 유저마다 오늘 피드를 만든다. 랭킹은 늘 10개까지 저장하고, 보여 줄 개수(feed_days.visible)만 플랜으로 정한다.
// 후보는 요약이 끝난 묶음(AI가 붙인 토픽)뿐이다. 모든 플랜이 같은 기본 요약을 본다(Pro 요약은 만들지 않는다, 2026-10-14).
const MAX_DAILY = 10;

export async function rank(ctx: Ctx) {
  // 오늘 피드는 각자 알림 시각에 만든다(slot.ts, 30분마다). 여기서는 알림 시각이 이미 된 사람만 만든다.
  // 피드는 서버 스케줄러의 deliveries 작업이 알림 시각마다 만든다. 이 단계는 손으로 몰아 돌릴 때만 쓴다
  const due = dueClock(ctx.now);
  const audience = (await loadAudience(ctx)).filter((a) => a.notifyAt <= due);
  const candidates = (await loadCandidates(ctx)).filter((c) => c.summarized);
  // 배치가 이미 만든 피드는 건너뛴다. 웹이 임시로 만든 피드(built_by='web')는 새 소식으로 다시 만든다
  const days = check(await db.from('feed_days').select('user_id,built_by').eq('date', ctx.date), 'feed_days') as { user_id: string; built_by: string }[];
  const done = new Set(days.filter((d) => d.built_by === 'pipeline').map((d) => d.user_id));
  const provisional = new Set(days.filter((d) => d.built_by === 'web').map((d) => d.user_id));

  let built = 0;
  let empty = 0;
  let failed = 0;
  for (const a of audience) {
    if (done.has(a.id) && !ctx.force) continue;
    try {
      const exclude = new Set(await withSimilarExcluded(a, candidates));
      // 다시 만들 때(웹 임시 피드, --force): 이미 보여 준 소식(맹고로 더 받은 것 포함)은 그 자리에 두고 나머지만 새로 고른다.
      // 더 받은 개수(extra)도 지키고 보여 줄 개수는 줄이지 않는다(instant.ts와 같다. 전엔 지우고 다시 넣어 산 소식이 사라졌다)
      const rebuild = ctx.force || provisional.has(a.id);
      const prev = rebuild ? await previousDay(a.id, ctx.date) : null;
      const kept = prev ? prev.rows.slice(0, prev.visible) : [];
      for (const k of kept) exclude.add(k.cluster_id);
      const ranked = rankFeed(candidates, a.weights, exclude, { limit: Math.max(0, MAX_DAILY - kept.length), maxLinks: linkCap(a.dailyItems) });
      const rows = [...kept, ...ranked.map((r) => ({ cluster_id: r.clusterId, topic_id: r.topicId }))];
      if (!rows.length) {
        empty++;
        ctx.log(`  ${a.id.slice(0, 8)}: 맞는 소식이 없어 오늘 피드가 비어요`);
        continue;
      }
      if (prev) {
        check(await db.from('feeds').delete().eq('user_id', a.id).eq('date', ctx.date), 'feeds delete');
        check(await db.from('feed_days').delete().eq('user_id', a.id).eq('date', ctx.date), 'feed_days delete');
      }
      check(
        await db.from('feeds').insert(rows.map((r, i) => ({ user_id: a.id, date: ctx.date, rank: i + 1, cluster_id: r.cluster_id, topic_id: r.topic_id }))),
        'feeds insert',
      );
      const extra = prev?.extra ?? 0;
      const visible = Math.min(rows.length, Math.max(prev?.visible ?? 0, a.dailyItems + extra));
      check(await db.from('feed_days').insert({ user_id: a.id, date: ctx.date, visible, extra }), 'feed_days insert');
      built++;
    } catch (e) {
      // 한 사람이 실패해도(웹이 동시에 만들어 순번이 겹침 등) 나머지는 계속 만든다
      failed++;
      ctx.log(`  ${a.id.slice(0, 8)}: 피드 만들기 실패 ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  }

  ctx.stats.rank = { users: audience.length, built, empty, failed, candidates: candidates.length };
  ctx.log(`rank: 유저 ${audience.length}명 중 ${built}명 피드 생성(빈 피드 ${empty}, 실패 ${failed}) · 후보 ${candidates.length}개`);
}

/** 지금 있는 오늘 피드(다시 만들 때 지킬 것): 보여 준 개수, 더 받은 개수, 순번 차례의 소식 */
async function previousDay(userId: string, date: string): Promise<{ visible: number; extra: number; rows: { cluster_id: number; topic_id: string }[] } | null> {
  const day = check(await db.from('feed_days').select('visible,extra').eq('user_id', userId).eq('date', date).maybeSingle(), 'feed_days prev') as { visible: number; extra: number } | null;
  if (!day) return null;
  const rows = check(await db.from('feeds').select('cluster_id,topic_id').eq('user_id', userId).eq('date', date).order('rank'), 'feeds prev') as { cluster_id: number; topic_id: string }[];
  return { visible: day.visible, extra: day.extra, rows };
}
