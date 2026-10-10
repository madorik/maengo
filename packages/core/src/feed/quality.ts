// 글의 질 = 출처 신빙성(sources.weight) × 인기(조회수·점수). 웹(첫 피드)과 파이프라인이 같이 쓴다.
// 같은 소식 안에서 대표 글(요약·원문 링크로 쓰는 글)을 고르고, 소식끼리 순위를 매길 때(rankFeed의 popularity) 쓴다.
// 블로그·기사는 조회수가 공개되지 않아 출처 신빙성과 여러 곳에서 다뤘는지(묶음 크기)로만 본다.

export interface QualitySignals {
  /** 출처 가중치. 공식·큐레이션은 높고 기사량이 많은 매체는 낮다(pipeline/src/sources.ts) */
  sourceWeight: number;
  /** 유튜브 조회수(채널 RSS의 media:statistics) */
  views?: number | null;
  /** 해커 뉴스 점수(이 출처는 200점 이상만 받는다) */
  hnPoints?: number | null;
  publishedAt?: string | Date | null;
}

const DAY = 86_400_000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * 인기 배수. 신호가 없으면 1.
 * - 영상: 하루 조회수로 본다(올린 지 얼마 안 된 영상이 불리하지 않게). 10회 0.95 · 100회 1.1 · 1천 회 1.25 · 1만 회 1.4 · 0.8~1.5
 * - 해커 뉴스: 200점 1.0 · 1천 점 1.17 · 2천 점 1.25 · 최대 1.3
 */
export function popularityBoost(s: QualitySignals, now: Date = new Date()): number {
  if (s.views != null) {
    const published = s.publishedAt ? new Date(s.publishedAt).getTime() : now.getTime();
    const ageDays = Math.max(0.25, (now.getTime() - published) / DAY);
    return clamp(0.8 + 0.15 * Math.log10(s.views / ageDays + 1), 0.8, 1.5);
  }
  if (s.hnPoints != null) return clamp(1 + 0.25 * Math.log10(s.hnPoints / 200), 1, 1.3);
  return 1;
}

export function itemQuality(s: QualitySignals, now: Date = new Date()): number {
  return s.sourceWeight * popularityBoost(s, now);
}

/** 요약 프롬프트에 붙이는 출처 신뢰도. 공식·큐레이션·전문 출처(가중치 1.0 이상)는 높음 */
export function credibilityLabel(sourceWeight: number): '높음' | '보통' {
  return sourceWeight >= 1 ? '높음' : '보통';
}
