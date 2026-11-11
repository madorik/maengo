// 분야 8개와 하루 두 번(출근길·퇴근길) 브리핑(2026-11-10 사용자, 맹고-문서/맞춤-소식.md).
// - 사용자는 키워드를 고르지 않는다. 맹고가 이 8개 분야의 비중을 맞춘다.
// - 화면의 분야 표시는 소식에 붙은 뉴스 분야 토픽(헤드라인) → 관심 분야(AI·주식 등) → 요약 카테고리 순으로 정한다.
// - 오전(낮 12시 전)에 열면 '출근길', 오후에 열면 '퇴근길'. 정해진 시각은 두지 않는다(알림 시각은 설정에서 따로).
import type { CategoryId } from './categories';
import { TOPIC_BY_ID } from './topics/dictionary';

export const SECTIONS = [
  { id: 'politics', label: '정치' },
  { id: 'economy', label: '경제' },
  { id: 'society', label: '사회' },
  { id: 'life-culture', label: '생활/문화' },
  { id: 'it-science', label: 'IT/과학' },
  { id: 'world', label: '세계' },
  { id: 'sports', label: '스포츠' },
  { id: 'entertainment', label: '엔터' },
  // 2026-11-11 사용자: 온보딩에 부동산도. 전에는 경제 안에 묶였다(출퇴근하는 30~50대가 따로 챙기는 분야)
  { id: 'real-estate', label: '부동산' },
] as const;

/**
 * 사람들이 많이 보는 분야 순서(온보딩 '끌리는 소식' 타일 기본 순서, 2026-11-11 사용자 '관심사가 높은 순서로').
 * 회원들의 읽기·듣기 기록이 있으면 그 순서가 먼저다(apps/web/lib/server/onboarding-picks.ts). 대상: 출퇴근하는 30~50대 직장인
 */
export const POPULAR_SECTION_ORDER: readonly SectionId[] = ['economy', 'real-estate', 'politics', 'it-science', 'society', 'world', 'sports', 'entertainment', 'life-culture'];

export type SectionId = (typeof SECTIONS)[number]['id'];

export const SECTION_IDS = SECTIONS.map((s) => s.id) as SectionId[];

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label])) as Record<SectionId, string>;

export function isSection(v: unknown): v is SectionId {
  return typeof v === 'string' && (SECTION_IDS as string[]).includes(v);
}

/** 관심 분야(큰 분류) → 분야 */
const GROUP_SECTION: Readonly<Record<string, SectionId>> = {
  ai: 'it-science',
  dev: 'it-science',
  'chip-robot': 'it-science',
  stock: 'economy',
  coin: 'economy',
};

/** 요약 카테고리(18개) → 분야. 기타는 없음 */
const CATEGORY_SECTION: Readonly<Record<CategoryId, SectionId | null>> = {
  ai: 'it-science',
  tech: 'it-science',
  science: 'it-science',
  design: 'life-culture',
  business: 'economy',
  marketing: 'economy',
  career: 'economy',
  finance: 'economy',
  crypto: 'economy',
  realestate: 'real-estate',
  politics: 'politics',
  society: 'society',
  world: 'world',
  entertainment: 'entertainment',
  sports: 'sports',
  beauty: 'life-culture',
  food: 'life-culture',
  travel: 'life-culture',
  life: 'life-culture',
  etc: null,
};

/** 토픽이 속한 분야: 분야 자신, 관심 분야(AI·주식 등)와 그 상세 관심사는 위 표로. 없으면 null */
export function sectionOfTopic(topicId: string): SectionId | null {
  if (isSection(topicId)) return topicId;
  const group = TOPIC_BY_ID.get(topicId)?.parent ?? topicId;
  return GROUP_SECTION[group] ?? null;
}

/** 비중에 분야가 하나라도 있으면 분야로 고르는 사람(2026-11-10 뒤 가입·온보딩) */
export function usesSections(weights: Record<string, number>): boolean {
  return Object.entries(weights).some(([t, w]) => w > 0 && isSection(t));
}

/**
 * 분야로 고르는 사람에게는 소식의 토픽에 분야를 덧붙인다(AI 소식이면 IT/과학도, 관련도는 같게). 이미 있으면 큰 관련도를 남긴다.
 * 비중은 분야 8개만 두고(관심사별 몫·돌아가며 빠지기는 분야 단위), 헤드라인이 아닌 AI·주식 소식도 IT/과학·경제로 받게 한다
 */
export function withSectionTopics<T extends { topicId: string; relevance: number }>(topics: readonly T[]): { topicId: string; relevance: number }[] {
  const out = new Map<string, number>();
  for (const t of topics) {
    out.set(t.topicId, Math.max(out.get(t.topicId) ?? 0, t.relevance));
    const s = sectionOfTopic(t.topicId);
    if (s && s !== t.topicId) out.set(s, Math.max(out.get(s) ?? 0, t.relevance));
  }
  return [...out].map(([topicId, relevance]) => ({ topicId, relevance }));
}

/**
 * 소식의 분야. topicIds는 그 소식에 붙은 토픽(cluster_topics, 관련도 순이면 좋다).
 * 뉴스 분야 토픽이 있으면 그것, 없으면 관심 분야에서, 그래도 없으면 요약 카테고리에서 고른다. 못 정하면 null
 */
export function sectionOf(input: { category?: CategoryId | null; topicIds?: readonly string[] }): SectionId | null {
  for (const t of input.topicIds ?? []) if (isSection(t)) return t;
  for (const t of input.topicIds ?? []) if (GROUP_SECTION[t]) return GROUP_SECTION[t]!;
  return input.category ? CATEGORY_SECTION[input.category] ?? null : null;
}

/** 하루 두 번 브리핑의 몫. 한국 시각 낮 12시 전이면 오전(출근길) */
export type BriefingSlot = 'am' | 'pm';

export function briefingSlot(now: Date = new Date()): BriefingSlot {
  const kstHour = (now.getUTCHours() + 9) % 24;
  return kstHour < 12 ? 'am' : 'pm';
}

export const SLOT_LABEL: Readonly<Record<BriefingSlot, string>> = { am: '출근길', pm: '퇴근길' };
