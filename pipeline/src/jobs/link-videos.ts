import { GeminiQuotaError } from '@maengo/core/gemini';
import { isLinkTopicId, linkSourceId } from '@maengo/core/topics';
import type { Audience } from '../lib/audience';
import { HOUR, type Ctx } from '../lib/ctx';
import { check, db } from '../lib/db';
import { youtubeSeconds } from '../lib/extract';
import { mapLimit } from '../lib/limit';
import { youtubeIdOf } from '../lib/url';
import { allocateLinkVideos, LINK_VIDEO, withinBudget, type VideoPick } from '../lib/link-video-rules';
import { summarizeCluster } from './summarize';

// 내 관심 링크의 유튜브 채널 영상 요약(2026-11-08 사용자 결정, ROADMAP 10번). 하루 한 번 summarize 단계 맨 앞에서 돈다.
// - 사용자가 넣은 채널(custom 출처)만. 맹고가 정해 둔 유튜브 출처는 꺼 두었고 여기서도 보지 않는다
// - 채널마다 하루 1편: 최근 1주일 안 영상 중 아직 요약 안 된(누구에게도 안 간) 가장 새 영상. 1분~1시간만(긴 영상은 자르지 않고 건너뜀)
//   (2026-11-08 48시간 → 1주일, '사용자에게 중복되지 않은 것만'. 받은·읽은 소식은 원래 규칙대로 그 사람에게 다시 안 간다)
// - 묶기(cluster)는 72시간 창이라 4~7일 된 영상은 묶음이 없다: 여기서 영상 하나짜리 묶음을 만든다(ensureVideoClusters)
// - 한 사람이 받는 영상은 하루 합계 90분까지. 넘치면 다음 날로(1주일이 지나면 버림). 여러 사람이 넣은 채널의 영상은 한 번만 요약한다
// - 하루 전체 상한: Premium(체험 포함) 한 명당 ₩52(1시간 영상 한 편 값). 정상이면 닿지 않고 버그만 막는다
// 배송·지금 받기·하나 더 받기는 영상을 요약하지 않는다(videos: 0). 여기서 요약해 둔 영상만 후보가 된다(audience.summarizable).

const YT_FEED = 'https://www.youtube.com/feeds/videos.xml%';

/**
 * 묶음이 없는 채널 영상(72시간 창 밖이라 묶기가 건너뛴 4~7일 된 영상)에 영상 하나짜리 묶음을 만든다.
 * 묶기 단계가 새 묶음을 만드는 모양과 같다(대표 글 = 그 영상, 처음 본 때 = 발행 시각, 중심 = 임베딩이 있으면 그것). 링크 태그('s-<id>')도 붙인다
 */
async function ensureVideoClusters(ctx: Ctx, channelIds: number[], since: string): Promise<number> {
  const loose = check(
    await db.from('items').select('id,source_id,published_at,embedding').in('source_id', channelIds).eq('kind', 'video').gte('published_at', since).is('cluster_id', null),
    'loose link videos',
  ) as { id: number; source_id: number; published_at: string; embedding: string | null }[];
  for (const it of loose) {
    const [c] = check(
      await db.from('clusters').insert({ rep_item_id: it.id, first_seen_at: it.published_at, last_seen_at: ctx.now.toISOString() }).select('id'),
      'link video cluster',
    ) as { id: number }[];
    check(await db.rpc('set_item_clusters', { p: [{ id: it.id, c: c!.id }] }), 'set_item_clusters');
    check(await db.from('clusters').update({ size: 1, is_video: true, ...(it.embedding ? { centroid: it.embedding } : {}) }).eq('id', c!.id), 'link video cluster update');
    check(await db.from('cluster_topics').upsert({ cluster_id: c!.id, topic_id: `s-${it.source_id}`, relevance: 1 }, { onConflict: 'cluster_id,topic_id' }), 'link video tag');
  }
  return loose.length;
}

interface VideoItem {
  cluster_id: number | null;
  source_id: number;
  canonical_url: string;
  published_at: string | null;
}

export async function summarizeLinkVideos(ctx: Ctx, audience: Audience[]): Promise<void> {
  const premium = audience.filter((a) => a.plan !== 'free');
  const users = premium
    .map((a) => ({ sources: Object.keys(a.weights).filter((t) => isLinkTopicId(t) && a.weights[t]! > 0).map((t) => linkSourceId(t)!), exclude: a.exclude }))
    .filter((u) => u.sources.length);
  const sourceIds = [...new Set(users.flatMap((u) => u.sources))];
  if (!sourceIds.length) return void ctx.log(`link videos: 링크를 넣은 Premium 없음(Premium ${premium.length}명)`);
  const channels = check(
    await db.from('sources').select('id').in('id', sourceIds).eq('custom', true).eq('active', true).like('url', YT_FEED),
    'link video sources',
  ) as { id: number }[];
  if (!channels.length) return void ctx.log(`link videos: 유튜브 채널 없음(링크 ${sourceIds.length}곳)`);
  const channelIds = channels.map((c) => c.id);

  const since = new Date(ctx.now.getTime() - LINK_VIDEO.maxAgeHours * HOUR).toISOString();
  const made = await ensureVideoClusters(ctx, channelIds, since);
  if (made) ctx.log(`link videos: 묶음 없던 영상 ${made}편에 묶음을 만듦`);
  const items = check(
    await db
      .from('items')
      .select('cluster_id,source_id,canonical_url,published_at')
      .in('source_id', channelIds)
      .eq('kind', 'video')
      .gte('published_at', since)
      .not('cluster_id', 'is', null)
      .order('published_at', { ascending: false }),
    'link video items',
  ) as VideoItem[];
  // 오늘(KST) 이미 요약한 채널은 건너뛴다(채널마다 하루 1편). 요약된 묶음·건너뛴 묶음은 다시 보지 않는다
  const clusterIds = [...new Set(items.map((i) => i.cluster_id!))];
  const [summarized, skipped] = clusterIds.length
    ? await Promise.all([
        db.from('summaries').select('cluster_id,created_at').in('cluster_id', clusterIds).eq('tier', 'basic'),
        db.from('clusters').select('id').in('id', clusterIds).not('skip_reason', 'is', null),
      ])
    : [{ data: [] }, { data: [] }];
  const doneAt = new Map(((summarized.data ?? []) as { cluster_id: number; created_at: string }[]).map((r) => [r.cluster_id, r.created_at]));
  const skippedIds = new Set(((skipped.data ?? []) as { id: number }[]).map((r) => r.id));
  const todayStart = Date.parse(`${ctx.date}T00:00:00+09:00`);
  const doneToday = new Set(items.filter((i) => Date.parse(doneAt.get(i.cluster_id!) ?? '') >= todayStart).map((i) => i.source_id));

  // 채널마다 가장 새 영상 하나(최신순으로 받아 왔으니 처음 만나는 것). 그 채널을 넣은 사람이 모두 이미 받았거나 읽은 영상은 건너뛴다
  const subscribers = new Map<number, Set<number>[]>();
  for (const u of users) for (const s of u.sources) (subscribers.get(s) ?? subscribers.set(s, []).get(s)!).push(u.exclude);
  const seenByAll = (i: VideoItem) => (subscribers.get(i.source_id) ?? []).every((ex) => ex.has(i.cluster_id!));
  const newest = new Map<number, VideoItem>();
  for (const i of items) {
    if (doneToday.has(i.source_id) || newest.has(i.source_id)) continue;
    if (doneAt.has(i.cluster_id!) || skippedIds.has(i.cluster_id!) || seenByAll(i)) continue;
    newest.set(i.source_id, i);
  }

  // 길이는 영상 페이지에서(비용 0). 1분이 안 되거나(라이브·예정 포함) 1시간이 넘으면 묶음에 까닭을 남겨 다시 보지 않는다
  const picks = new Map<number, VideoPick>();
  const seconds = new Map<number, number>();
  let unreadable = 0;
  await mapLimit([...newest], 4, async ([sourceId, it]) => {
    const vid = youtubeIdOf(it.canonical_url);
    const sec = vid ? await youtubeSeconds(vid) : null;
    if (sec == null) return void unreadable++; // 못 읽었으면 다음 실행에서 다시
    if (sec < LINK_VIDEO.minSeconds || sec > LINK_VIDEO.maxSeconds) {
      const reason = sec < LINK_VIDEO.minSeconds ? '1분이 안 되는 영상(라이브·예정 포함)' : `영상이 ${Math.round(sec / 60)}분이라 김(1시간까지)`;
      await db.from('clusters').update({ skip_reason: reason }).eq('id', it.cluster_id!);
      return;
    }
    picks.set(sourceId, { clusterId: it.cluster_id!, seconds: sec, publishedAt: Date.parse(it.published_at ?? '') || 0 });
    seconds.set(it.cluster_id!, sec);
  });

  const allocated = allocateLinkVideos(users, picks);
  const spent = check(
    await db.from('usage_log').select('est_usd').eq('kind', 'video').gte('at', new Date(todayStart).toISOString()),
    'video usage today',
  ) as { est_usd: number }[];
  const capUsd = (premium.length * LINK_VIDEO.krwPerPremium) / LINK_VIDEO.usdKrw;
  const spentUsd = spent.reduce((s, r) => s + Number(r.est_usd), 0);
  const queue = withinBudget(allocated, seconds, capUsd - spentUsd);
  ctx.log(
    `link videos: 채널 ${channelIds.length}곳 · 후보 ${newest.size}편 · 길이 못 읽음 ${unreadable}편 · 길이 통과 ${picks.size}편 · 사람별 90분 ${allocated.length}편 · 예산 안 ${queue.length}편` +
      ` (오늘 $${spentUsd.toFixed(3)} / 상한 $${capUsd.toFixed(3)})`,
  );

  const counts = { ok: 0, skipped: 0, deferred: 0, failed: 0 };
  let quotaHit = false;
  await mapLimit(queue, 3, async (id) => {
    if (quotaHit || (ctx.budget?.deadline && Date.now() > ctx.budget.deadline)) {
      counts.deferred++;
      return;
    }
    try {
      counts[await summarizeCluster(ctx, id, 'basic', { videos: 1, maxVideoMinutes: LINK_VIDEO.maxSeconds / 60 })]++;
    } catch (e) {
      if (e instanceof GeminiQuotaError) quotaHit = true;
      counts.failed++;
      ctx.log(`  영상 요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  });
  ctx.stats.linkVideos = { channels: channelIds.length, candidates: newest.size, unreadable, allocated: allocated.length, queued: queue.length, ...counts, spentUsd, capUsd };
  ctx.log(`link videos: 완료 ${counts.ok} · 소식 아님 ${counts.skipped} · 미룸 ${counts.deferred} · 실패 ${counts.failed}`);
}
