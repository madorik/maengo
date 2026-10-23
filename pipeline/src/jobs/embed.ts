import { db, check, inChunks, selectAll, toVector } from '../lib/db';
import { HOUR, type Ctx } from '../lib/ctx';
import { interestFilter, topicsInUse } from '../lib/interest';
import { interleaveBy } from '../lib/limit';

/**
 * 3. embed: 제목 + RSS 설명을 768차원으로. 본문은 읽지 않는다(요약 대상만 읽는다).
 * 누군가 고른 관심사에 걸리는 글만 한다(lib/interest.ts). 하루 4천 개 넘게 모이는데 피드에 쓰이는 건 일부라서.
 * 피드가 고르는 기간(windowHours)의 글만 본다. 관심사를 새로 고르면 그 기간 안의 글은 다음 실행에서 한다.
 */
export async function embed(ctx: Ctx) {
  const since = new Date(ctx.now.getTime() - ctx.windowHours * HOUR).toISOString();
  // 출처마다 최신 글부터 돌아가며. 서버 스케줄러는 한 번에 embedLimit개까지만(남은 것은 다음 실행)
  // 그냥 최신 id순이면 수집 순서상 맨 뒤인 뉴스 분야 피드가 상한을 다 차지했다(2026-10-21~22 임베딩 1,200개가 전부 언론사 글, 긱뉴스 0/81)
  const all = await selectAll<{ id: number; title: string; excerpt: string | null; source_id: number | null }>((from, to) =>
    db.from('items').select('id,title,excerpt,source_id').is('embedding', null).gte('fetched_at', since).order('id', { ascending: false }).range(from, to),
  );
  const wanted = await interestFilter(ctx, await topicsInUse());
  const picked = interleaveBy(all.filter(wanted), (i) => i.source_id);
  const items = picked.slice(0, ctx.budget?.embedLimit ?? picked.length).map(({ id, title, excerpt }) => ({ id, title, excerpt }));
  if (!items.length) {
    ctx.stats.embed = { embedded: 0, matched: picked.length, skipped: all.length - picked.length };
    ctx.log(`embed: 관심사에 걸린 새 글 없음(안 걸린 글 ${all.length}개는 건너뜀)`);
    return;
  }
  // 묶기·태그·합치기에 쓸 시간을 남기고 멈춘다(남은 글은 창 안이면 다음 실행에서). 상한을 크게 잡아도 서버 함수 시간을 넘지 않게
  let embedded = 0;
  for (let i = 0; i < items.length; i += EMBED_CHUNK) {
    if (ctx.budget?.deadline && ctx.budget.deadline - Date.now() < EMBED_RESERVE_MS) break;
    const chunk = items.slice(i, i + EMBED_CHUNK);
    await embedItems(ctx, chunk);
    embedded += chunk.length;
  }
  ctx.stats.embed = { embedded, matched: picked.length, skipped: all.length - picked.length, deferred: items.length - embedded };
  ctx.log(`embed: 관심사에 걸린 ${picked.length}개 중 ${embedded}개(안 걸린 ${all.length - picked.length}개는 건너뜀${embedded < items.length ? `, 시간이 모자라 ${items.length - embedded}개는 다음으로` : ''})`);
}

/** 한 번에 임베딩·저장하는 글 수. 이 단위로 남은 시간을 본다 */
const EMBED_CHUNK = 500;
/** 임베딩 뒤 묶기·태그·합치기에 남길 시간 */
const EMBED_RESERVE_MS = 90_000;

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
