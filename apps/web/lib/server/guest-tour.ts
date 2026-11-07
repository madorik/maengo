import 'server-only';
import { cache } from 'react';
import { isCategory } from '@maengo/core/categories';
import { isTryAudioKey, TRY_ITEMS } from '../try-items';
import type { GuestItem, GuestLine } from '../types';
import { db, must } from './db';

// 로그인 없이 둘러보기(/try, 맹고-문서/둘러보기.md). 고정해 둔 소식(lib/try-items.ts)을 그 순서대로 늘 똑같이 보여 준다.
// 음성은 이미 만든 것만 쓰고 TTS는 부르지 않는다(비용 0). 걸러 낸 소식, 내 관심 링크 글뿐인 소식, 음성이 없어진 소식은 빼고 보여 준다.

interface SummaryRow {
  cluster_id: number;
  title: string;
  short: string;
  category: string;
  author: string | null;
  clusters: { skip_reason: string | null; rep_item_id: number | null };
}

interface MemberRow {
  id: number;
  cluster_id: number;
  canonical_url: string;
  kind: 'article' | 'video';
  author: string | null;
  sources: { name: string; custom: boolean } | null;
}

interface SegRow {
  key: string;
  cluster_id: number;
  duration_ms: number;
  lines: GuestLine[];
}

/** 대표 글이 공개 출처면 그 글, 아니면 공개 출처 글 중 첫 글. 없으면 null(내 관심 링크 글뿐인 소식) */
function publicRep(members: MemberRow[], repId: number | null): MemberRow | null {
  const open = members.filter((m) => m.sources && !m.sources.custom);
  return open.find((m) => m.id === repId) ?? open[0] ?? null;
}

/** 둘러볼 소식(고정 목록 순서). 한 번 그릴 때 한 번만 읽는다 */
export const guestTour = cache(async (): Promise<GuestItem[]> => {
  const ids = TRY_ITEMS.map((t) => t.clusterId);
  const [summaries, members, segs] = await Promise.all([
    db.from('summaries').select('cluster_id,title,short,category,author,clusters!inner(skip_reason,rep_item_id)').eq('tier', 'basic').in('cluster_id', ids),
    db.from('items').select('id,cluster_id,canonical_url,kind,author,sources(name,custom)').in('cluster_id', ids),
    db.from('audio_segments').select('key,cluster_id,duration_ms,lines').in('key', TRY_ITEMS.map((t) => t.audioKey)),
  ]);
  const summaryOf = new Map((must(summaries, 'try summaries') as unknown as SummaryRow[]).map((s) => [s.cluster_id, s]));
  const segOf = new Map((must(segs, 'try audio') as SegRow[]).map((s) => [s.key, s]));
  const byCluster = new Map<number, MemberRow[]>();
  for (const m of must(members, 'try items') as unknown as MemberRow[]) (byCluster.get(m.cluster_id) ?? byCluster.set(m.cluster_id, []).get(m.cluster_id)!).push(m);

  return TRY_ITEMS.flatMap(({ clusterId, audioKey }) => {
    const s = summaryOf.get(clusterId);
    const seg = segOf.get(audioKey);
    if (!s || s.clusters.skip_reason || !seg || seg.cluster_id !== clusterId || !seg.lines?.length) return [];
    const rep = publicRep(byCluster.get(clusterId) ?? [], s.clusters.rep_item_id);
    if (!rep) return [];
    return [
      {
        clusterId,
        title: s.title,
        short: s.short,
        category: isCategory(s.category) ? s.category : 'etc',
        kind: rep.kind,
        sourceLabel: rep.sources!.name,
        author: s.author ?? rep.author ?? rep.sources!.name,
        url: rep.canonical_url,
        audioKey,
        durationMs: seg.duration_ms,
        lines: seg.lines.map(({ text, startMs, endMs, para }) => ({ text, startMs, endMs, ...(para !== undefined ? { para } : {}) })),
      },
    ];
  });
});

/** 둘러보기 음성 파일의 저장소 키. 고정 목록의 음성만 내준다. 없으면 null */
export async function guestAudioObject(key: string): Promise<string | null> {
  if (!isTryAudioKey(key)) return null;
  const seg = must(await db.from('audio_segments').select('r2_key').eq('key', key).maybeSingle(), 'try audio object') as { r2_key: string } | null;
  return seg?.r2_key ?? null;
}
