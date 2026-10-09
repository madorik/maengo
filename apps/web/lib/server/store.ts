import 'server-only';
import { addDays, kstDate } from '@maengo/core/kst';
import { initialTopicWeights } from '@maengo/core/topics';
import type { CategoryId } from '@maengo/core/categories';
import type { FeedbackKind, Persona, Plan, Voice } from '@maengo/core/types';
import { ARCHIVE_CLUSTERS } from './demo-clusters';

// 메모리 저장소. Supabase가 붙기 전까지 PLAN.md 4장 테이블을 같은 모양으로 흉내 낸다.
// 개발 서버를 다시 켜면 비워진다. HMR에도 살아남도록 globalThis에 둔다.

export interface Profile {
  id: string;
  displayName: string | null;
  provider: 'apple' | 'google';
  notifyAt: string;
  plan: Plan;
  trialEndsAt: number | null;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
}

export interface FeedRow {
  rank: number;
  clusterId: number;
  topicId: string;
}

/** 하루 피드. rows는 랭킹 상위 최대 10개, visible은 그날 플랜으로 보여 준 개수 */
export interface FeedRecord {
  rows: FeedRow[];
  visible: number;
}

export interface FeedbackRow {
  kind: FeedbackKind;
  topicId: string;
  /** 이 피드백이 가중치에 더한 값. 피드백을 바꾸거나 지울 때 되돌린다 */
  delta: number;
}

export interface ReadRow {
  readAt?: number;
  listenedAt?: number;
}

interface Store {
  profiles: Map<string, Profile>;
  topicWeights: Map<string, Record<string, number>>;
  /** 키: user|YYYY-MM-DD */
  feeds: Map<string, FeedRecord>;
  feedback: Map<string, Map<number, FeedbackRow>>;
  reads: Map<string, Map<number, ReadRow>>;
  /** cluster_why 캐시. 키: cluster|topic|tier */
  why: Map<string, { text: string; model: string }>;
  /** 클러스터 카테고리 캐시(요약 단계에서 한 번 분류) */
  categories: Map<number, CategoryId>;
  /** 문장으로 토픽 추가한 횟수. 키: user|YYYY-MM-DD */
  topicMapUsage: Map<string, number>;
  /** 사전에 없던 관심사(unmatched_interests). 토픽 사전을 늘릴 근거 */
  unmatched: { userId: string; text: string; at: number }[];
}

const g = globalThis as typeof globalThis & { __maengoStore?: Store };

export const store: Store = (g.__maengoStore ??= {
  profiles: new Map(),
  topicWeights: new Map(),
  feeds: new Map(),
  feedback: new Map(),
  reads: new Map(),
  why: new Map(),
  categories: new Map(),
  topicMapUsage: new Map(),
  unmatched: [],
});

const DAY_MS = 24 * 60 * 60 * 1000;

// 온보딩이 붙기 전까지 쓰는 데모 프로필. 직업은 받지 않고 관심 토픽 5개만 골랐다.
const DEMO_TOPICS = ['llm-agent', 'rag', 'llm-dev', 'backend-perf', 'database'];

export function createDemoProfile(id: string, provider: 'apple' | 'google'): Profile {
  // 데모: 어제까지 무료로 14일을 썼고(하루 1개), 오늘 플러스 체험을 시작했다. 지난 피드는 보관함에 쌓여 있다.
  const today = kstDate();
  const readDays = [1, 2, 3, 4, 6, 7, 9, 11];
  const reads = new Map<number, ReadRow>();
  for (const a of ARCHIVE_CLUSTERS) {
    store.feeds.set(`${id}|${addDays(today, -a.daysAgo)}`, { rows: [{ rank: 1, clusterId: a.id, topicId: a.topicId }], visible: 1 });
    if (readDays.includes(a.daysAgo)) reads.set(a.id, { readAt: Date.now() - a.daysAgo * DAY_MS });
  }
  store.reads.set(id, reads);
  const profile: Profile = {
    id,
    displayName: null,
    provider,
    notifyAt: '07:00',
    plan: 'trial',
    trialEndsAt: Date.now() + 7 * DAY_MS,
    persona: 'teacher',
    voice: 'f',
    autoNext: true,
    skipRead: false,
  };
  store.profiles.set(id, profile);
  store.topicWeights.set(id, initialTopicWeights(DEMO_TOPICS));
  return profile;
}

export function resetUser(id: string) {
  const provider = store.profiles.get(id)?.provider ?? 'google';
  for (const key of store.feeds.keys()) if (key.startsWith(`${id}|`)) store.feeds.delete(key);
  store.feedback.delete(id);
  store.reads.delete(id);
  createDemoProfile(id, provider);
}

export function weightsOf(userId: string): Record<string, number> {
  let w = store.topicWeights.get(userId);
  if (!w) store.topicWeights.set(userId, (w = {}));
  return w;
}

export function feedbackOf(userId: string): Map<number, FeedbackRow> {
  let m = store.feedback.get(userId);
  if (!m) store.feedback.set(userId, (m = new Map()));
  return m;
}

export function readsOf(userId: string): Map<number, ReadRow> {
  let m = store.reads.get(userId);
  if (!m) store.reads.set(userId, (m = new Map()));
  return m;
}

export function trialDaysLeft(p: Profile, now = Date.now()): number | null {
  if (p.plan !== 'trial' || !p.trialEndsAt) return null;
  return Math.max(0, Math.ceil((p.trialEndsAt - now) / DAY_MS));
}

/** PLAN.md 9.1 entitlements. 권한은 여기 한 곳에서만 판단한다. */
export function entitlements(p: Profile) {
  const paid = p.plan !== 'free';
  // 하루 소식 수: 무료 1개, 플러스·체험 최대 10개
  return { audio: paid, podcast: paid, pack: paid, topicLimit: paid ? 20 : 5, dailyItems: paid ? 10 : 1 };
}
