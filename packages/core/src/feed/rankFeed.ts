import { isLinkTopicId } from '../topics/links';
import type { FeedbackKind } from '../types';
import { impactBoost, impactOf, MAJOR_FIRST_HOURS, type Impact } from './impact';
import { isStaleMarketQuote } from './market';
import { langBoost } from './quality';

// PLAN.md 6.3 랭킹 공식. 순수 함수라 웹(첫 피드)과 파이프라인(rank 단계)이 같이 쓴다.
// 내 관심 링크(토픽 's-…')의 글은 관련도 1이라 늘 위로 가므로, 하루 소식의 절반까지만 고른다(maxLinks, 2026-10-15 D19). 모자라면 제약을 풀어 채운다.
// 큰 소식(새 AI 모델 출시·보안 위협처럼 일·돈·안전에 바로 영향을 주는 것, impact.ts)은 점수를 더 주고 이틀 안이면 맨 앞에 놓는다(2026-10-27).

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
  /** 대표 글 제목(요약이 있으면 요약 제목). 이틀 지난 시세 기사를 빼는 데 쓴다(market.ts). 없으면 빼지 않는다 */
  title?: string | null;
  /** 대표 글 출처의 언어. 한국어면 점수를 더 준다(quality.ts langBoost). 없으면 배수 1 */
  lang?: string | null;
  /** 요약할 때 AI가 매긴 소식의 무게(summaries.impact). 없으면 제목으로 본다(impact.ts impactOf) */
  impact?: Impact | null;
}

export interface RankOptions {
  limit?: number;
  /** 이 사람이 실제로 받는 수(하루 소식). limit에 여분을 더해 고를 때 넘긴다. 관심사별 몫(perTopicShare)을 이 수로 나눈다. 없으면 limit */
  visible?: number;
  maxPerTopic?: number;
  maxVideos?: number;
  /** 대표 토픽이 내 관심 링크인 소식의 상한. 없으면 제한 없음 */
  maxLinks?: number;
  /** 피드 날짜(KST 'YYYY-MM-DD'). 관심사가 받는 수보다 많으면 이 날짜로 돌아가며 먼저 줄 관심사를 고른다(todaysTopics). 없으면 돌리지 않는다 */
  day?: string;
}

/**
 * 이보다 관련도가 낮은 분류는 랭킹에서 없는 셈 친다. 임베딩 분류(tag 단계)는 관련도 0.5 이상이면 89%, 0.4 이상 82%가 맞고
 * 그 아래는 '김천 고물상 매몰 → 코스피(0.06)' 같은 잡음이었다(2026-10-23, 요약된 묶음 109개의 AI 분류와 비교). AI 분류는 곁가지도 0.4 이상이다
 */
export const MIN_RELEVANCE = 0.4;

/**
 * 관심사가 하루 받는 수보다 많을 때 오늘 먼저 한 자리씩 줄 관심사: 이름순으로 늘어놓고 날마다 한 칸씩 밀어 visible개.
 * 점수로만 고르면 늘 같은 관심사가 빠졌다(무료 3개에 관심사 4개 → 반도체·로봇이 매일 빠짐, 2026-10-23). 관심사가 받는 수 이하면 null
 */
export function todaysTopics(weights: Record<string, number>, visible: number, day: string): string[] | null {
  const interests = Object.keys(weights).filter((t) => !isLinkTopicId(t) && (weights[t] ?? 0) > 0).sort();
  if (interests.length <= visible) return null;
  const start = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) % interests.length;
  return Array.from({ length: visible }, (_, i) => interests[(start + i) % interests.length]!);
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
  return freshness * c.sourceWeight * langBoost(c.lang) * impactBoost(impactOf(c)) * (c.popularity ?? 1) * (1 + 0.3 * Math.log(Math.max(1, c.size)));
}

/**
 * 이 사람 관심사 중 이 소식의 대표 토픽(가중치 × 관련도가 가장 큰 것). 없으면 null.
 * 요약하면 AI가 분류를 다시 정하므로(summarizeCluster), 요약 뒤에 다시 불러 관심사가 남았는지 본다
 */
export function bestTopic(topics: RankCandidate['topics'], weights: Record<string, number>): string | null {
  let best = { topicId: '', value: 0 };
  for (const t of topics) {
    if (t.relevance < MIN_RELEVANCE) continue;
    const value = (weights[t.topicId] ?? 0) * t.relevance;
    if (value > best.value) best = { topicId: t.topicId, value };
  }
  return best.topicId || null;
}

/**
 * 관심사 하나가 하루 소식에서 먼저 차지할 수 있는 수: 하루 소식 수를 고른 관심사 수로 나눈 몫(올림).
 * 전에는 늘 2개라 무료(하루 3개)로 관심사 셋을 고르면 한 관심사가 2개를 가져가 하나는 못 받았다(2026-10-23)
 */
export function perTopicShare(limit: number, weights: Record<string, number>): number {
  const interests = Object.keys(weights).filter((t) => !isLinkTopicId(t) && (weights[t] ?? 0) > 0).length;
  return Math.max(1, Math.ceil(limit / Math.max(1, interests)));
}

export function rankFeed(
  candidates: RankCandidate[],
  weights: Record<string, number>,
  exclude: ReadonlySet<number>,
  { limit = 5, visible = limit, maxPerTopic = perTopicShare(visible, weights), maxVideos = 2, maxLinks = Infinity, day }: RankOptions = {},
): RankedItem[] {
  const scored: (RankedItem & { isVideo: boolean; major: boolean })[] = [];
  for (const c of candidates) {
    if (exclude.has(c.id) || isStaleMarketQuote(c)) continue;
    let relevance = 0;
    for (const t of c.topics) if (t.relevance >= MIN_RELEVANCE) relevance += (weights[t.topicId] ?? 0) * t.relevance;
    const topicId = bestTopic(c.topics, weights);
    if (relevance <= 0 || !topicId) continue;
    const major = impactOf(c) === 'major' && c.ageHours <= MAJOR_FIRST_HOURS;
    scored.push({ clusterId: c.id, topicId, score: relevance * baseScore(c), isVideo: c.isVideo, major });
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
  let majors = 0;
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
      if (s.major) majors++;
    }
  };
  // 고른 차례대로 돌려준다(각 단계 안은 점수순). 부르는 쪽은 여분까지 고른 뒤 앞에서부터 하루 소식만큼 쓰므로,
  // 전체를 점수순으로 다시 섞으면 제약을 풀어 채운 같은 관심사 소식이 앞으로 와서 관심사별 몫이 깨진다(2026-10-23)
  // 큰 소식을 맨 먼저: 관심사 차례보다 앞서지만 관심사별 몫은 지키고, 하루 소식의 절반(올림)까지만
  const maxMajors = Math.ceil(visible / 2);
  fill((s) => s.major && majors < maxMajors && (perTopic.get(s.topicId) ?? 0) < maxPerTopic && underCaps(s));
  // 관심사가 받는 수보다 많으면 오늘 차례인 관심사에 먼저 하나씩(점수순)
  const todays = day ? new Set(todaysTopics(weights, visible, day)) : null;
  if (todays?.size) fill((s) => todays.has(s.topicId) && !perTopic.has(s.topicId) && underCaps(s));
  fill((s) => (perTopic.get(s.topicId) ?? 0) < maxPerTopic && underCaps(s));
  fill(underCaps);
  fill(() => true);
  return picked.map(({ clusterId, topicId, score }) => ({ clusterId, topicId, score }));
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
