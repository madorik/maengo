import { GEMINI_MODELS } from '@maengo/core/ai';
import { credibilityLabel, itemQuality, linkCap, rankFeed } from '@maengo/core/feed';
import { GeminiOutputError, GeminiQuotaError, PROMPT_VERSION } from '@maengo/core/gemini';
import { isNewsSection, NEWS_SECTIONS, TOPIC_BY_ID, whyLead, withParents } from '@maengo/core/topics';
import { SECTION_IDS } from '@maengo/core/sections';
import type { SummarizeSource } from '@maengo/core/ai';
import type { Tier } from '@maengo/core/types';
import { db, check } from '../lib/db';
import { env } from '../lib/env';
import { articleImage, extractArticle, youtubeSeconds } from '../lib/extract';
import { mapLimit } from '../lib/limit';
import { dictionary, loadAudience, loadCandidates, withSimilarExcluded } from '../lib/audience';
import { youtubeIdOf } from '../lib/url';
import type { Ctx } from '../lib/ctx';
import { summarizeLinkVideos } from './link-videos';

// 7. summarize: 유저 관심사로 미리 랭킹해 보고, 누군가의 피드에 들어갈 만한 묶음만 요약한다.
// 한 번의 호출로 제목·요약·전체 글·카테고리·토픽·토픽별 "왜 중요한가"를 같이 받는다.

/** 피드에 실제로 들어갈 수보다 넉넉히 요약해 둔다(요약하면서 토픽이 바뀌거나 소식이 아니라고 빠질 수 있어서) */
const BUFFER = { free: 2, paid: 5 };
/**
 * 돈을 내고 받은 요약이 비었거나(안전 필터·출력 토큰 한도) JSON이 깨진 횟수가 이만큼 되면 그 묶음은 건너뛴다(skip_reason).
 * 세지 않으면 1분 배송이 사람마다·실행마다 같은 묶음을 다시 골라 또 부른다(마이그레이션 20261018192000)
 */
const MAX_SUMMARY_FAILURES = 3;

async function noteSummaryFailure(clusterId: number, reason: string) {
  const { data, error } = await db.rpc('note_summary_failure', { p_cluster: clusterId, p_reason: reason.slice(0, 120), p_max: MAX_SUMMARY_FAILURES });
  // 마이그레이션 전이면 함수가 없다: 세지 못할 뿐 요약 실패는 그대로 알린다
  if (error) return void console.error('note_summary_failure', error.message);
  if (Number(data) >= MAX_SUMMARY_FAILURES) console.log(`[summarize] #${clusterId} 요약이 ${data}번 실패해 건너뜀: ${reason.slice(0, 80)}`);
}

interface MemberRow {
  id: number;
  canonical_url: string;
  title: string;
  kind: 'article' | 'video';
  author: string | null;
  published_at: string | null;
  excerpt: string | null;
  image_url: string | null;
  source_id: number | null;
  views: number | null;
  hn_points: number | null;
  sources: { name: string; weight: number; custom: boolean } | null;
}

export type SummaryResult = 'ok' | 'skipped' | 'deferred' | 'failed';

/**
 * 묶음 하나를 요약해 summaries·cluster_topics·cluster_why에 넣는다. pro 등급은 토픽을 바꾸지 않는다.
 * 뉴스 분야(정치·경제 등) 태그는 tag 단계(tagHeadlines)가, 내 관심 링크 태그('s-…')는 tagLinks가 정하고 여기서는 건드리지 않는다.
 * 구성원이 모두 사용자가 넣은 출처(custom)인 묶음에는 AI 토픽도 붙이지 않는다(넣은 사람만 받는다, D15).
 * 헤드라인 묶음이면 그 분야만 사전에 넣어 AI가 그 분야의 why를 쓰게 한다.
 */
export async function summarizeCluster(
  ctx: Ctx,
  clusterId: number,
  tier: Tier,
  /** videos: 이번 실행에서 더 요약할 수 있는 영상 수, maxVideoMinutes: 이보다 긴 영상은 건너뜀(기본 env, 내 관심 링크 영상은 60분) */
  budget: { videos: number; maxVideoMinutes?: number },
): Promise<SummaryResult> {
  const members = check(
    await db
      .from('items')
      .select('id,canonical_url,title,kind,author,published_at,excerpt,image_url,source_id,views,hn_points,sources(name,weight,custom)')
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
  const linkOnly = members.every((m) => m.sources?.custom);

  let videoUrl: string | undefined;
  if (rep.kind === 'video') {
    const vid = youtubeIdOf(rep.canonical_url);
    if (!vid) return 'failed';
    if (budget.videos <= 0) return 'deferred';
    const seconds = await youtubeSeconds(vid);
    if (seconds == null || seconds > (budget.maxVideoMinutes ?? env.maxVideoMinutes) * 60) {
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
  // 원문을 읽은 김에 RSS에 이미지가 없던 글의 대표 이미지(og:image)를 남긴다(상세 화면 사진, 2026-11-10). 못 남겨도 요약은 계속한다
  await Promise.all(
    picked
      .filter((m) => m.kind === 'article' && !m.image_url)
      .map(async (m) => {
        const image = articleImage(m.canonical_url);
        if (image) await db.from('items').update({ image_url: image }).eq('id', m.id).is('image_url', null);
      }),
  );

  const headline = check(
    await db.from('cluster_topics').select('topic_id').eq('cluster_id', clusterId).in('topic_id', NEWS_SECTIONS.map((t) => t.id)),
    'cluster_topics news',
  ) as { topic_id: string }[];
  const sections = new Set(headline.map((r) => r.topic_id));
  const topicDict = (await dictionary(ctx)).filter((t) => !isNewsSection(t.id) || sections.has(t.id));
  const nameOf = new Map(topicDict.map((t) => [t.id, t.name]));
  let out: Awaited<ReturnType<Ctx['ai']['summarize']>>;
  try {
    out = await ctx.ai.summarize({ model: GEMINI_MODELS.summary, kind: rep.kind, sources, videoUrl, dictionary: topicDict });
  } catch (e) {
    if (e instanceof GeminiOutputError && tier === 'basic') await noteSummaryFailure(clusterId, e.message);
    throw e;
  }
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
        impact: out.impact,
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
      await db.from('cluster_topics').delete().eq('cluster_id', clusterId).not('topic_id', 'in', `(${NEWS_SECTIONS.map((t) => t.id).join(',')})`).not('topic_id', 'like', 's-%'),
      'cluster_topics delete',
    );
    if (topics.length && !linkOnly) {
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

/**
 * 분야 몫(2026-11-10 사용자 '온보딩에 스포츠·엔터가 없다'): 최근 48시간 안에 요약된 소식이 없는 분야마다 가장 큰 소식 하나.
 * 요약은 배송 때 그 사람 소식만 만들어서, 받는 회원이 없는 분야는 요약이 안 생겨 온보딩 '끌리는 소식' 고르기에 타일이 빠진다
 */
function showcasePicks(candidates: Awaited<ReturnType<typeof loadCandidates>>, day: string): number[] {
  const out: number[] = [];
  for (const section of SECTION_IDS) {
    const inSection = candidates.filter((c) => c.topics.some((t) => t.topicId === section));
    if (inSection.some((c) => c.summarized && c.ageHours <= 48)) continue;
    const best = rankFeed(inSection.filter((c) => !c.summarized && !c.isVideo), { [section]: 1 }, new Set(), { limit: 1, visible: 1, day })[0];
    if (best && !out.includes(best.clusterId)) out.push(best.clusterId);
  }
  return out;
}

/**
 * 수집(ingest·ingest_pm) 끝에 분야 몫만 요약한다(2026-11-11). summarize 작업은 꺼 두어서(scheduler.ts) 위 몫이 돌지 않았다.
 * 하루 많아야 분야 수 × 수집 횟수(8 × 2)번이고, 요약된 소식이 이미 있는 분야는 건너뛴다
 */
export async function summarizeSectionShowcase(ctx: Ctx): Promise<void> {
  const candidates = await loadCandidates(ctx);
  const picks = showcasePicks(candidates, ctx.date);
  let ok = 0;
  for (const id of picks) {
    if (ctx.budget?.deadline && Date.now() > ctx.budget.deadline) break;
    try {
      if ((await summarizeCluster(ctx, id, 'basic', { videos: 0 })) === 'ok') ok++;
    } catch (e) {
      if (e instanceof GeminiQuotaError) break;
      ctx.log(`  분야 몫 요약 실패 #${id}: ${String((e as Error).message ?? e).slice(0, 160)}`);
    }
  }
  ctx.stats.showcase = { picked: picks.length, ok };
  ctx.log(`showcase: 분야 몫 ${picks.length}개 중 ${ok}개 요약`);
}

export async function summarize(ctx: Ctx) {
  const audience = await loadAudience(ctx);
  // 내 관심 링크의 유튜브 채널 영상을 먼저(채널당 하루 1편·1시간·한 사람 90분·하루 상한). 실패해도 글 요약은 이어 간다
  try {
    await summarizeLinkVideos(ctx, audience);
  } catch (e) {
    ctx.log(`link videos 실패: ${String((e as Error).message ?? e).slice(0, 200)}`);
  }
  const candidates = await loadCandidates(ctx);
  const needed = new Map<number, number>(); // 묶음 → 가장 높은 유저 점수
  for (const a of audience) {
    const exclude = await withSimilarExcluded(a, candidates);
    const want = a.dailyItems + (a.plan === 'free' ? BUFFER.free : BUFFER.paid);
    for (const r of rankFeed(candidates, a.weights, exclude, { limit: want, visible: a.dailyItems, maxLinks: linkCap(a.dailyItems), day: ctx.date })) {
      const c = candidates.find((x) => x.id === r.clusterId)!;
      if (!c.summarized) needed.set(r.clusterId, Math.max(needed.get(r.clusterId) ?? 0, r.score));
    }
  }
  // 분야 몫(아래 showcasePicks). 받는 회원이 없는 분야도 요약된 소식이 하나는 있게
  const showcase = showcasePicks(candidates, ctx.date);
  const limit = ctx.budget?.summarizeLimit ?? env.summarizeLimit;
  const byUsers = [...needed].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => !showcase.includes(id));
  const queue = [...showcase, ...byUsers].slice(0, Math.max(limit, showcase.length));
  ctx.log(`summarize: 유저 ${audience.length}명 · 후보 ${candidates.length}개 → 요약할 묶음 ${queue.length}개(상한 ${limit}, 분야 몫 ${showcase.length})`);

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
