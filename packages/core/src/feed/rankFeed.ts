import type { FeedbackKind } from '../types';

// PLAN.md 6.3 랭킹 공식. 순수 함수라 웹(첫 피드)과 파이프라인(rank 단계)이 같이 쓴다.

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
  { limit = 5, maxPerTopic = 2, maxVideos = 2 }: RankOptions = {},
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

  // 다양성 제약을 지키며 고르고, 그래도 모자라면 제약을 풀어 채운다(콜드 스타트).
  const picked: typeof scored = [];
  const perTopic = new Map<string, number>();
  let videos = 0;
  for (const s of scored) {
    if (picked.length === limit) break;
    if ((perTopic.get(s.topicId) ?? 0) >= maxPerTopic) continue;
    if (s.isVideo && videos >= maxVideos) continue;
    picked.push(s);
    perTopic.set(s.topicId, (perTopic.get(s.topicId) ?? 0) + 1);
    if (s.isVideo) videos++;
  }
  for (const s of scored) {
    if (picked.length === limit) break;
    if (!picked.includes(s)) picked.push(s);
  }
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
