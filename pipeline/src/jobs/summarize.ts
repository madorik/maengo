import { modelFor } from '@maengo/core/ai';
import { credibilityLabel, itemQuality, rankFeed } from '@maengo/core/feed';
import { GeminiQuotaError, PROMPT_VERSION } from '@maengo/core/gemini';
import { isNewsSection, NEWS_SECTIONS, TOPIC_BY_ID, whyLead, withParents } from '@maengo/core/topics';
import type { SummarizeSource } from '@maengo/core/ai';
import type { Tier } from '@maengo/core/types';
import { db, check } from '../lib/db';
import { env } from '../lib/env';
import { extractArticle, youtubeSeconds } from '../lib/extract';
import { mapLimit } from '../lib/limit';
import { dictionary, loadAudience, loadCandidates, withSimilarExcluded } from '../lib/audience';
import { youtubeIdOf } from '../lib/url';
import type { Ctx } from '../lib/ctx';

// 7. summarize: 유저 관심사로 미리 랭킹해 보고, 누군가의 피드에 들어갈 만한 묶음만 요약한다.
// 한 번의 호출로 제목·요약·전체 글·카테고리·토픽·토픽별 "왜 중요한가"를 같이 받는다.

/** 피드에 실제로 들어갈 수보다 넉넉히 요약해 둔다(요약하면서 토픽이 바뀌거나 소식이 아니라고 빠질 수 있어서) */
const BUFFER = { free: 2, paid: 5 };

interface MemberRow {
  id: number;
  canonical_url: string;
  title: string;
  kind: 'article' | 'video';
  author: string | null;
  published_at: string | null;
  excerpt: string | null;
  source_id: number | null;
  views: number | null;
  hn_points: number | null;
  sources: { name: string; weight: number } | null;
}

export type SummaryResult = 'ok' | 'skipped' | 'deferred' | 'failed';

/**
 * 묶음 하나를 요약해 summaries·cluster_topics·cluster_why에 넣는다. pro 등급은 토픽을 바꾸지 않는다.
 * 뉴스 분야(정치·경제 등) 태그는 tag 단계(tagHeadlines)가 정하고 여기서는 건드리지 않는다.
 * 헤드라인 묶음이면 그 분야만 사전에 넣어 AI가 그 분야의 why를 쓰게 한다.
 */
export async function summarizeCluster(
  ctx: Ctx,
  clusterId: number,
  tier: Tier,
  budget: { videos: number },
): Promise<SummaryResult> {
  const members = check(
    await db
      .from('items')
      .select('id,canonical_url,title,kind,author,published_at,excerpt,source_id,views,hn_points,sources(name,weight)')
      .eq('cluster_id', clusterId),
    'members',
  ) as unknown as MemberRow[];
  const { data: cluster } = await db.from('clusters').select('rep_item_id').eq('id', clusterId).single();
  if (!members.length) return 'failed';
  // 대표 글을 맨 앞에, 나머지는 출처 신빙성 × 인기 순. 앞의 글일수록 본문을 길게 읽고 프롬프트도 사실의 기준으로 삼는다
  const quality = (m: MemberRow) =>
    itemQuality({ sourceWeight: m.sources?.weight ?? 1, views: m.views, hnPoints: m.hn_points, publishedAt: m.published_at }, ctx.now);
  members.sort((a, b) => (a.id === cluster?.rep_item_id ? -1 : b.id === cluster?.rep_item_id ? 1 : quality(b) - quality(a)));
  // 영상 요약 예산이 없으면(서버 스케줄러는 videoLimit 0) 같은 소식의 글을 기준으로 요약한다. 영상만 있는 묶음은 미룬다
  if (members[0]!.kind === 'video' && budget.videos <= 0) {
    const i = members.findIndex((m) => m.kind === 'article');
    if (i > 0) members.unshift(...members.splice(i, 1));
  }
  const rep = members[0]!;
  const picked = members.slice(0, 3);

  let videoUrl: string | undefined;
  if (rep.kind === 'video') {
    const vid = youtubeIdOf(rep.canonical_url);
    if (!vid) return 'failed';
    if (budget.videos <= 0) return 'deferred';
    const seconds = await youtubeSeconds(vid);
    if (seconds == null || seconds > env.maxVideoMinutes * 60) {
      await db.from('clusters').update({ skip_reason: seconds == null ? '영상 길이를 알 수 없음' : `영상이 ${Math.round(seconds / 60)}분이라 김` }).eq('id', clusterId);
      return 'skipped';
    }
    budget.videos--;
    videoUrl = rep.canonical_url;
  }

  const sources: SummarizeSource[] = await Promise.all(
    picked.map(async (m, i) => {
      const body = m.kind === 'article' ? await extractArticle(m.canonical_url, i === 0 ? 8000 : 3000) : '';
      return {
        title: m.title,
        sourceName: m.sources?.name ?? '',
        url: m.canonical_url,
        author: m.author,
        publishedAt: m.published_at,
        credibility: credibilityLabel(m.sources?.weight ?? 1),
        views: m.views,
        hnPoints: m.hn_points,
        text: body.length >= 200 ? body : m.excerpt ?? '',
      };
    }),
  );

  const headline = check(
    await db.from('cluster_topics').select('topic_id').eq('cluster_id', clusterId).in('topic_id', NEWS_SECTIONS.map((t) => t.id)),
    'cluster_topics news',
  ) as { topic_id: string }[];
  const sections = new Set(headline.map((r) => r.topic_id));
  const topicDict = (await dictionary(ctx)).filter((t) => !isNewsSection(t.id) || sections.has(t.id));
  const nameOf = new Map(topicDict.map((t) => [t.id, t.name]));
  const out = await ctx.ai.summarize({ model: modelFor(tier), kind: rep.kind, sources, videoUrl, dictionary: topicDict });
  if (out.skip || !out.title || !out.body.length) {
    if (tier === 'basic') await db.from('clusters').update({ skip_reason: out.skip ?? '요약이 비어 있음' }).eq('id', clusterId);
    return 'skipped';
  }

  check(
    await db.from('summaries').upsert(
      {
        cluster_id: clusterId,
        tier,
        title: out.title,
        short: out.short,
        body: out.body,
        author: out.author || rep.author || rep.sources?.name || null,
        category: out.category,
        published_at: rep.published_at,
        scenes: out.scenes?.length ? out.scenes : null,
        model: out.model,
        version: PROMPT_VERSION,
      },
      { onConflict: 'cluster_id,tier' },
    ),
    'summaries upsert',
  );
  // 상세 관심사 태그에 큰 분류를 더한다. 큰 분류의 why는 가장 관련 높은 자식의 문구를 쓴다
  const topics = withParents(out.topics).filter((t) => !isNewsSection(t.topicId));
  const whyByTopic = new Map(out.why.map((w) => [w.topicId, w.text]));
  for (const t of [...out.topics].sort((a, b) => b.relevance - a.relevance)) {
    const parent = TOPIC_BY_ID.get(t.topicId)?.parent;
    const text = whyByTopic.get(t.topicId);
    if (parent && text && !whyByTopic.has(parent)) whyByTopic.set(parent, text);
  }
  const whys = [...whyByTopic].map(([topicId, text]) => ({ topicId, text }));
  if (tier === 'basic') {
    check(
      await db.from('cluster_topics').delete().eq('cluster_id', clusterId).not('topic_id', 'in', `(${NEWS_SECTIONS.map((t) => t.id).join(',')})`),
      'cluster_topics delete',
    );
    if (topics.length) {
      check(
        await db.from('cluster_topics').insert(topics.map((t) => ({ cluster_id: clusterId, topic_id: t.topicId, relevance: t.relevance }))),
        'cluster_topics insert',
      );
    }
  }
  if (whys.length) {
    check(
      await db.from('cluster_why').upsert(
        whys.map((w) => ({
          cluster_id: clusterId,
          topic_id: w.topicId,
          tier,
          why: `${whyLead(nameOf.get(w.topicId) ?? w.topicId)}: ${w.text}`,
        })),
        { onConflict: 'cluster_id,topic_id,tier' },
      ),
      'cluster_why upsert',
    );
  }
  return 'ok';
}

export async function summarize(ctx: Ctx) {
  const audience = await loadAudience(ctx);
  const candidates = await loadCandidates(ctx);
  const needed = new Map<number, number>(); // 묶음 → 가장 높은 유저 점수
  for (const a of audience) {
    const exclude = await withSimilarExcluded(a, candidates);
    const want = a.dailyItems + (a.plan === 'free' ? BUFFER.free : BUFFER.paid);
    for (const r of rankFeed(candidates, a.weights, exclude, { limit: want })) {
      const c = candidates.find((x) => x.id === r.clusterId)!;
      if (!c.summarized) needed.set(r.clusterId, Math.max(needed.get(r.clusterId) ?? 0, r.score));
    }
  }
  const limit = ctx.budget?.summarizeLimit ?? env.summarizeLimit;
  const queue = [...needed].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  ctx.log(`summarize: 유저 ${audience.length}명 · 후보 ${candidates.length}개 → 요약할 묶음 ${queue.length}개(상한 ${limit})`);

  const counts: Record<SummaryResult, number> = { ok: 0, skipped: 0, deferred: 0, failed: 0 };
  const budget = { videos: ctx.budget?.videoLimit ?? env.videoLimit };
  let quotaHit = false;
  await mapLimit(queue, 3, async (id) => {
    if (quotaHit) return;
    // 서버 함수 시간이 모자라면 남은 요약은 다음 실행으로
    if (ctx.budget?.deadline && Date.now() > ctx.budget.deadline) {
      counts.deferred++;
      return;
    }
    try {
      const r = await summarizeCluster(ctx, id, 'basic', budget);
      counts[r]++;
    } catch (e) {
      if (e instanceof GeminiQuotaError) {
        quotaHit = true;
        ctx.log(`  하루 할당량 소진(${e.model}). 남은 요약은 다음 실행으로 미룸`);
        return;
      }
      counts.failed++;
      ctx.log(`  요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  });
  ctx.stats.summarize = { users: audience.length, candidates: candidates.length, queued: queue.length, ...counts, quotaHit };
  ctx.log(`summarize: 완료 ${counts.ok} · 소식 아님 ${counts.skipped} · 미룸 ${counts.deferred} · 실패 ${counts.failed}`);
}
