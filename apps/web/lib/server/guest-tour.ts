import 'server-only';
import { cache } from 'react';
import { isCategory, type CategoryId } from '@maengo/core/categories';
import { impactBoost, impactOf, isImpact } from '@maengo/core/feed';
import type { Voice } from '@maengo/core/types';
import { basicTts, premiumTts, type TtsEngine } from './ai';
import { db, must } from './db';
import { currentSegmentKey } from './episode';
import { pickGuestItems } from '../guest-tour-pick';
import type { GuestItem, GuestLine } from '../types';

// 로그인 없이 둘러보기(/try, 2026-11-07 사용자 결정, 맹고-문서/둘러보기.md).
// 누군가 이미 만든 음성이 있는 소식을 최대 GUEST_TOUR_MAX개 들려준다. TTS는 부르지 않는다(비용 0).
// 공개 분야 페이지(public-topics.ts)와 같이 걸러 낸 소식(skip_reason)과 사용자가 넣은 출처(내 관심 링크)뿐인 소식은 뺀다.
// 음성은 지금 대본·엔진·목소리로 만든 것만 쓴다(currentSegmentKey와 키가 같은 것). Premium 목소리(Gemini)를 먼저, 같은 엔진이면 여성 목소리를 먼저.

export const GUEST_TOUR_MAX = 10;
/** 이 기간 안에 만든 음성만 본다 */
const SEGMENT_DAYS = 3;
/** 최근 음성을 이만큼까지만 훑는다 */
const SEGMENT_SCAN = 400;
/** 한 분야는 먼저 이만큼까지만 넣고, 모자라면 마저 채운다(AI 소식만 열 개가 되지 않게) */
const PER_CATEGORY = 3;
const DAY = 24 * 3600_000;

interface SegRow {
  key: string;
  cluster_id: number;
  voice: string;
  duration_ms: number;
}

interface SummaryRow {
  cluster_id: number;
  title: string;
  short: string;
  body: string[];
  category: string;
  author: string | null;
  impact: string | null;
  published_at: string | null;
  clusters: { first_seen_at: string; skip_reason: string | null; rep_item_id: number | null };
}

interface MemberRow {
  id: number;
  cluster_id: number;
  canonical_url: string;
  kind: 'article' | 'video';
  author?: string | null;
  sources: { name: string; custom: boolean } | null;
}

/** id를 size개씩 나눠 읽는다(주소 길이 한도) */
async function inChunks<T>(ids: number[], size: number, read: (chunk: number[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await read(ids.slice(i, i + size))));
  return out;
}

/** 음성 선호 순서: Premium 목소리 여성 → 남성 → 기본 목소리 여성 → 남성(작을수록 먼저) */
function voiceRanks(): { engine: TtsEngine; voice: Voice; rank: number }[] {
  const engines = premiumTts === basicTts ? [basicTts] : [premiumTts, basicTts];
  return engines.flatMap((engine, e) => (['f', 'm'] as const).map((voice, v) => ({ engine, voice, rank: e * 2 + v })));
}

/** 대표 글이 공개 출처면 그 글, 아니면 공개 출처 글 중 첫 글. 없으면 null(내 관심 링크 글뿐인 소식) */
function publicRep(members: MemberRow[], repId: number | null): MemberRow | null {
  const open = members.filter((m) => m.sources && !m.sources.custom);
  return open.find((m) => m.id === repId) ?? open[0] ?? null;
}

/** 둘러볼 소식(최대 GUEST_TOUR_MAX개). 한 번 그릴 때 한 번만 읽는다 */
export const guestTour = cache(async (): Promise<GuestItem[]> => {
  const since = new Date(Date.now() - SEGMENT_DAYS * DAY).toISOString();
  const segs = must(
    await db
      .from('audio_segments')
      .select('key,cluster_id,voice,duration_ms')
      .eq('persona', 'announcer')
      .in('voice', ['f', 'm'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(SEGMENT_SCAN),
    'guest audio_segments',
  ) as SegRow[];
  const ids = [...new Set(segs.map((s) => s.cluster_id))];
  if (!ids.length) return [];

  const summaries = await inChunks(ids, 150, async (chunk) =>
    must(
      await db
        .from('summaries')
        .select('cluster_id,title,short,body,category,author,impact,published_at,clusters!inner(first_seen_at,skip_reason,rep_item_id)')
        .eq('tier', 'basic')
        .in('cluster_id', chunk),
      'guest summaries',
    ) as unknown as SummaryRow[],
  );

  // 묶음마다 지금 대본으로 만든 음성 중 가장 앞 순서의 것
  const ranks = voiceRanks();
  const segByKey = new Map(segs.map((s) => [s.key, s]));
  const now = Date.now();
  const candidates = summaries.flatMap((s) => {
    if (s.clusters.skip_reason) return [];
    for (const r of ranks) {
      const seg = segByKey.get(currentSegmentKey(s, r.voice, r.engine));
      if (seg) {
        const date = s.published_at ?? s.clusters.first_seen_at;
        const ageDays = Math.max(0, (now - Date.parse(s.clusters.first_seen_at)) / DAY);
        // 이슈도가 높을수록, 새로울수록 앞에
        const score = impactBoost(impactOf({ impact: isImpact(s.impact) ? s.impact : null, title: s.title })) / (1 + ageDays);
        return [{ s, seg, premium: r.engine === premiumTts && premiumTts !== basicTts, date, score }];
      }
    }
    return [];
  });
  if (!candidates.length) return [];

  const members = await inChunks(
    candidates.map((c) => c.s.cluster_id),
    150,
    async (chunk) =>
      must(await db.from('items').select('id,cluster_id,canonical_url,kind,author,sources(name,custom)').in('cluster_id', chunk), 'guest items') as unknown as MemberRow[],
  );
  const byCluster = new Map<number, MemberRow[]>();
  for (const m of members) (byCluster.get(m.cluster_id) ?? byCluster.set(m.cluster_id, []).get(m.cluster_id)!).push(m);

  const ranked = candidates.flatMap((c) => {
    const rep = publicRep(byCluster.get(c.s.cluster_id) ?? [], c.s.clusters.rep_item_id);
    return rep ? [{ ...c, rep, category: (isCategory(c.s.category) ? c.s.category : 'etc') as CategoryId }] : [];
  });
  const picked = pickGuestItems(ranked, GUEST_TOUR_MAX, PER_CATEGORY);

  const lineRows = must(
    await db.from('audio_segments').select('key,lines').in('key', picked.map((c) => c.seg.key)),
    'guest lines',
  ) as { key: string; lines: GuestLine[] }[];
  const linesOf = new Map(lineRows.map((r) => [r.key, r.lines]));

  return picked.flatMap((c) => {
    const lines = linesOf.get(c.seg.key);
    if (!lines?.length) return [];
    return [
      {
        clusterId: c.s.cluster_id,
        title: c.s.title,
        short: c.s.short,
        category: c.category,
        kind: c.rep.kind,
        sourceLabel: c.rep.sources!.name,
        author: c.s.author ?? c.rep.author ?? c.rep.sources!.name,
        url: c.rep.canonical_url,
        date: c.date,
        audioKey: c.seg.key,
        durationMs: c.seg.duration_ms,
        lines: lines.map(({ text, startMs, endMs, para }) => ({ text, startMs, endMs, ...(para !== undefined ? { para } : {}) })),
      },
    ];
  });
});

/** 음성 키 모양(episode.ts segmentKey: 말투-목소리-해시 24자) */
const KEY_RE = /^announcer-[fm]-[0-9a-f]{24}$/;

/**
 * 둘러보기 음성 파일의 저장소 키. 키는 대본 해시라 대본을 모르면 알아낼 수 없고(둘러보기 화면이 건넨 키만 쓰인다),
 * 그래도 걸러 낸 소식·내 관심 링크 글뿐인 소식의 음성은 내주지 않는다. 없으면 null
 */
export async function guestAudioObject(key: string): Promise<string | null> {
  if (!KEY_RE.test(key)) return null;
  const seg = must(await db.from('audio_segments').select('r2_key,cluster_id').eq('key', key).maybeSingle(), 'guest audio') as {
    r2_key: string;
    cluster_id: number;
  } | null;
  if (!seg) return null;
  const [cluster, members] = await Promise.all([
    db.from('clusters').select('skip_reason,rep_item_id').eq('id', seg.cluster_id).maybeSingle(),
    db.from('items').select('id,cluster_id,canonical_url,kind,sources(name,custom)').eq('cluster_id', seg.cluster_id),
  ]);
  const c = must(cluster, 'guest audio cluster') as { skip_reason: string | null; rep_item_id: number | null } | null;
  if (!c || c.skip_reason) return null;
  if (!publicRep(must(members, 'guest audio items') as unknown as MemberRow[], c.rep_item_id)) return null;
  return seg.r2_key;
}
