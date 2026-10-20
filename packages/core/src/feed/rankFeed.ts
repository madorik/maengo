import { isLinkTopicId } from '../topics/links';
import type { FeedbackKind } from '../types';

// PLAN.md 6.3 랭킹 공식. 순수 함수라 웹(첫 피드)과 파이프라인(rank 단계)이 같이 쓴다.
// 내 관심 링크(토픽 's-…')의 글은 관련도 1이라 늘 위로 가므로, 하루 소식의 절반까지만 고른다(maxLinks, 2026-10-15 D19). 모자라면 제약을 풀어 채운다.

export interface RankCandidate {
  id: number;
  ageHours: number;
  sourceWeight: number;
  /** 같은 소식을 다룬 출처 수 */
  size: number;
  /** 대표 글의 인기 배수(조회수·점수, quality.ts). 없으면 1 */
  popularity?: number;
  isVideo: boolean;
  topics: { topicId: string; relevance: number }[];
}

export interface RankOptions {
  limit?: number;
  maxPerTopic?: number;
  maxVideos?: number;
  /** 대표 토픽이 내 관심 링크인 소식의 상한. 없으면 제한 없음 */
  maxLinks?: number;
}

/** 하루 소식 중 내 관심 링크 글의 상한: 절반(올림). Premium 10개면 5개 */
export function linkCap(dailyItems: number): number {
  return Math.ceil(dailyItems / 2);
}

export interface RankedItem {
  clusterId: number;
  /** why 문구를 고를 대표 토픽 */
  topicId: string;
  score: number;
}

const FRESHNESS_HOURS = 36;

export function baseScore(c: RankCandidate): number {
  const freshness = Math.exp(-Math.max(0, c.ageHours) / FRESHNESS_HOURS);
  return freshness * c.sourceWeight * (c.popularity ?? 1) * (1 + 0.3 * Math.log(Math.max(1, c.size)));
}

export function rankFeed(
  candidates: RankCandidate[],
  weights: Record<string, number>,
  exclude: ReadonlySet<number>,
  { limit = 5, maxPerTopic = 2, maxVideos = 2, maxLinks = Infinity }: RankOptions = {},
): RankedItem[] {
  const scored: (RankedItem & { isVideo: boolean })[] = [];
  for (const c of candidates) {
    if (exclude.has(c.id)) continue;
    let relevance = 0;
    let best = { topicId: '', value: 0 };
    for (const t of c.topics) {
      const value = (weights[t.topicId] ?? 0) * t.relevance;
      relevance += value;
      if (value > best.value) best = { topicId: t.topicId, value };
    }
    if (relevance <= 0) continue;
    scored.push({ clusterId: c.id, topicId: best.topicId, score: relevance * baseScore(c), isVideo: c.isVideo });
  }
  scored.sort((a, b) => b.score - a.score || a.clusterId - b.clusterId);

  // 다양성 제약을 지키며 고르고, 모자라면 제약을 차례로 풀어 채운다: 토픽당 개수를 먼저, 영상·링크 상한은 맨 나중에(콜드 스타트).
  // 전에는 한 번에 다 풀었다: 관심사가 하나뿐이면 토픽당 2개 다음이 바로 '제약 없음'이라 인기 높은 유튜브 영상이 자리를 다 차지했고,
  // 배송은 영상을 요약하지 않아(예산 0) Premium이 하루 3개만 받았다(2026-10-20)
  const picked: typeof scored = [];
  const taken = new Set<number>();
  const perTopic = new Map<string, number>();
  let videos = 0;
  let links = 0;
  const underCaps = (s: (typeof scored)[number]) => !(s.isVideo && videos >= maxVideos) && !(isLinkTopicId(s.topicId) && links >= maxLinks);
  const fill = (ok: (s: (typeof scored)[number]) => boolean) => {
    for (const s of scored) {
      if (picked.length === limit) break;
      if (taken.has(s.clusterId) || !ok(s)) continue;
      picked.push(s);
      taken.add(s.clusterId);
      perTopic.set(s.topicId, (perTopic.get(s.topicId) ?? 0) + 1);
      if (s.isVideo) videos++;
      if (isLinkTopicId(s.topicId)) links++;
    }
  };
  fill((s) => (perTopic.get(s.topicId) ?? 0) < maxPerTopic && underCaps(s));
  fill(underCaps);
  fill(() => true);
  return picked
    .sort((a, b) => b.score - a.score)
    .map(({ clusterId, topicId, score }) => ({ clusterId, topicId, score }));
}

export const WEIGHT_MIN = 0.1;
export const WEIGHT_MAX = 1.5;

/** 피드백 하나가 토픽 가중치를 얼마나 바꾸는지. known은 가중치 대신 비슷한 소식을 뺀다. */
export function feedbackDelta(kind: FeedbackKind, current: number): number {
  if (kind === 'more') return Math.min(WEIGHT_MAX, current + 0.1) - current;
  if (kind === 'skip') return Math.max(WEIGHT_MIN, current - 0.15) - current;
  return 0;
}

/** 이 피드백을 준 소식은 다음 피드에서 뺀다. */
export function excludesCluster(kind: FeedbackKind): boolean {
  return kind === 'known' || kind === 'skip';
}
