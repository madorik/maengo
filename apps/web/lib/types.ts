import type { CategoryId } from '@maengo/core/categories';
import type { Chapter, FeedbackKind, Persona, Plan, Voice } from '@maengo/core/types';

// 서버 → 클라이언트로 넘기는 화면용 데이터. 서버 전용 모듈을 끌어오지 않도록 타입만 둔다.

export interface FeedItem {
  rank: number;
  clusterId: number;
  /** 이 소식이 들어간 피드 날짜(YYYY-MM-DD) */
  feedDate: string;
  title: string;
  kind: 'article' | 'video';
  /** AI가 자동으로 고른 카테고리 */
  category: CategoryId;
  sourceLabel: string;
  /** 글쓴이 또는 유튜브 채널 */
  author: string;
  /** '오늘 오전 9시' 같은 작성 시각. 서버에서 KST로 만든다 */
  publishedLabel: string;
  coverage?: string;
  url: string;
  /** 유튜브 썸네일. 영상 ID를 알 수 없으면 null */
  thumbnail: string | null;
  /** 목록에 보이는 요약 */
  short: string;
  /** 상세 화면의 전체 글(문단) */
  body: string[];
  scenes?: { t: string; label: string }[];
  topicId: string;
  topicName: string;
  why: string;
}

export interface TodayData {
  date: string;
  /** 피드가 바뀌면 클라이언트 상태를 새로 시작하기 위한 키 */
  signature: string;
  greetingDate: string;
  jobLabel: string;
  topicNames: string[];
  readMinutes: number;
  notifyLabel: string;
  /** 플랜별 하루 소식 수(무료 1, 플러스 10) */
  dailyLimit: number;
  /** 플랜 때문에 오늘 못 보는 소식 수(무료 사용자 안내용) */
  hiddenCount: number;
  items: FeedItem[];
  read: number[];
  listened: number[];
  feedback: Record<number, FeedbackKind>;
}

export interface ProfileView {
  displayName: string | null;
  provider: 'apple' | 'google';
  plan: Plan;
  trialDaysLeft: number | null;
  audio: boolean;
  dailyItems: number;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
  /** 이 계정이 지금 쓰는 요약·문구 모델 */
  model: string;
  aiProvider: 'dummy' | 'gemini';
}

export interface EpisodeData {
  date: string;
  persona: Persona;
  voice: Voice;
  audioUrl: string;
  durationMs: number;
  chapters: Chapter[];
  /** 말투별 항목 길이(ms). 고르기 전에 "약 N분"을 보여 주는 데 쓴다 */
  estimates: Record<Persona, number[]>;
}

export interface LibraryEntry {
  clusterId: number;
  feedDate: string;
  title: string;
  short: string;
  kind: 'article' | 'video';
  category: CategoryId;
  sourceLabel: string;
  author: string;
  publishedLabel: string;
  read: boolean;
  listened: boolean;
}

export interface LibraryData {
  /** 지금까지 받은 소식 전체 수 */
  total: number;
  /** 카테고리로 거른 뒤의 수 */
  filteredTotal: number;
  page: number;
  pageCount: number;
  category: CategoryId | null;
  /** 받은 소식에 있는 카테고리와 개수 */
  categories: { id: CategoryId; label: string; count: number }[];
  /** 이 페이지의 소식을 피드 날짜별로 묶은 것 */
  groups: { date: string; label: string; entries: LibraryEntry[] }[];
}

/** 관심 토픽 고치기 결과(설정 화면 안내 문구) */
export type TopicResult = { tone: 'ok' | 'warn'; message: string };

export interface UserTopic {
  id: string;
  name: string;
}
