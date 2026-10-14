import { db, check, inChunks, selectAll, toVector } from '../lib/db';
import { HOUR, type Ctx } from '../lib/ctx';
import { interestFilter, topicsInUse } from '../lib/interest';

/**
 * 3. embed: 제목 + RSS 설명을 768차원으로. 본문은 읽지 않는다(요약 대상만 읽는다).
 * 누군가 고른 관심사에 걸리는 글만 한다(lib/interest.ts). 하루 4천 개 넘게 모이는데 피드에 쓰이는 건 일부라서.
 * 피드가 고르는 기간(windowHours)의 글만 본다. 관심사를 새로 고르면 그 기간 안의 글은 다음 실행에서 한다.
 */
export async function embed(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
  // 최신 글부터. 서버 스케줄러는 한 번에 embedLimit개까지만(남은 것은 다음 실행)
  const all = await selectAll<{ id: number; title: string; excerpt: string | null; source_id: number | null }>((from, to) =>
    db.from('items').select('id,title,excerpt,source_id').is('embedding', null).gte('fetched_at', since).order('id', { ascending: false }).range(from, to),
  );
  const wanted = await interestFilter(ctx, await topicsInUse());
  const picked = all.filter(wanted);
  const items = picked.slice(0, ctx.budget?.embedLimit ?? picked.length).map(({ id, title, excerpt }) => ({ id, title, excerpt }));
  ctx.stats.embed = { embedded: items.length, matched: picked.length, skipped: all.length - picked.length };
  if (!items.length) {
    ctx.log(`embed: 관심사에 걸린 새 글 없음(안 걸린 글 ${all.length}개는 건너뜀)`);
    return;
  }
  await embedItems(ctx, items);
  ctx.log(`embed: 관심사에 걸린 ${picked.length}개 중 ${items.length}개(안 걸린 ${all.length - picked.length}개는 건너뜀)`);
}

/** 임베딩에 넣는 글자 수(제목 + 설명 앞부분). 묶기·태그는 제목과 첫 문장으로 충분하고, 1,500자일 때보다 토큰이 30%쯤 준다(2026-10-14) */
const EMBED_TEXT_CHARS = 300;

/** 고른 글만 임베딩해 저장한다(즉석 피드가 관심사에 맞는 글만 먼저 처리할 때도 쓴다) */
export async function embedItems(ctx: Ctx, items: { id: number; title: string; excerpt: string | null }[]) {
  const vectors = await ctx.ai.embed(items.map((i) => `${i.title}\n${i.excerpt ?? ''}`.slice(0, EMBED_TEXT_CHARS)));
  const payload = items.map((i, k) => ({ id: i.id, v: toVector(vectors[k]!) }));
  await inChunks(payload, 50, async (chunk) => {
    check(await db.rpc('set_item_embeddings', { p: chunk }), 'set_item_embeddings');
  });
}
