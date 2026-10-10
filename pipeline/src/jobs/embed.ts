import { db, check, inChunks, selectAll, toVector } from '../lib/db';
import { HOUR, type Ctx } from '../lib/ctx';

/** 3. embed: 제목 + RSS 설명을 768차원으로. 본문은 읽지 않는다(요약 대상만 읽는다) */
export async function embed(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - 7 * 24 * HOUR).toISOString();
  const items = await selectAll<{ id: number; title: string; excerpt: string | null }>((from, to) =>
    db.from('items').select('id,title,excerpt').is('embedding', null).gte('fetched_at', since).order('id').range(from, to),
  );
  if (!items.length) {
    ctx.stats.embed = { embedded: 0 };
    ctx.log('embed: 새로 임베딩할 글 없음');
    return;
  }
  await embedItems(ctx, items);
  ctx.stats.embed = { embedded: items.length };
  ctx.log(`embed: ${items.length}개`);
}

/** 고른 글만 임베딩해 저장한다(즉석 피드가 관심사에 맞는 글만 먼저 처리할 때도 쓴다) */
export async function embedItems(ctx: Ctx, items: { id: number; title: string; excerpt: string | null }[]) {
  const vectors = await ctx.ai.embed(items.map((i) => `${i.title}\n${i.excerpt ?? ''}`.slice(0, 1500)));
  const payload = items.map((i, k) => ({ id: i.id, v: toVector(vectors[k]!) }));
  await inChunks(payload, 50, async (chunk) => {
    check(await db.rpc('set_item_embeddings', { p: chunk }), 'set_item_embeddings');
  });
}
