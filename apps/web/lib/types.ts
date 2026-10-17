import type { CategoryId } from '@maengo/core/categories';
import type { LinkError } from '@maengo/core/topics';
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
  topicNames: string[];
  readMinutes: number;
  notifyLabel: string;
  /** 하루 맹고(플랜의 하루 소식 수, plans 표) */
  dailyLimit: number;
  /** 하나 더 받을 때 쓰는 맹고(기본 개수를 다 채우기 전이면 0) */
  moreCost: number;
  /** 지갑 맹고(가입 선물·추가 구매한 맹고, 사라지지 않음). 하루 맹고보다 더 받을 때 1맹고씩 쓴다 */
  wallet: number;
  /** 오늘 소식이 비었을 때 왜 비었는지. first = 가입하고 아직 한 번도 안 받았다(눌러야 받는다), waiting = 오늘 배치가 아직 안 돌았다, exhausted = 토픽에서 안 본 소식을 다 썼다 */
  /** 약관이 바뀌기 전에 가입한 회원이라 바뀐 약관을 알려야 하는지(한 번 닫으면 이 기기에서는 다시 안 보인다) */
  termsNotice: boolean;
  /** scheduled = 알림 시각 전이라 오늘 소식을 아직 지급하지 않았다, arriving = 알림 시각이 돼 배송이 만드는 중 */
  emptyReason: 'first' | 'scheduled' | 'arriving' | 'waiting' | 'exhausted' | null;
  items: FeedItem[];
  read: number[];
  listened: number[];
  feedback: Record<number, FeedbackKind>;
}

export interface ProfileView {
  displayName: string | null;
  provider: 'apple' | 'google';
  email: string | null;
  avatarUrl: string | null;
  /** 데모 계정으로 들어왔는지(애플 연동 전) */
  demo: boolean;
  plan: Plan;
  audio: boolean;
  dailyItems: number;
  /** 맹고 추가 구매를 할 수 있는지(plans 표) */
  canBuyMaengo: boolean;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
  aiProvider: 'dummy' | 'gemini';
}

export interface EpisodeData {
  date: string;
  persona: Persona;
  voice: Voice;
  audioUrl: string;
  /** 음성이 다 만들어져 있는지. false면 chapters·durationMs는 어림값이고, audioUrl을 열 때 음성을 만든다 */
  ready: boolean;
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

/** 보관함 거르기: 안 읽은 소식만(2026-10-15 '읽음' 칸은 뺌) */
export type LibraryReadFilter = 'unread';

export interface LibraryData {
  /** 지금까지 받은 소식 전체 수 */
  total: number;
  /** 카테고리로 거른 뒤의 수 */
  filteredTotal: number;
  page: number;
  pageCount: number;
  category: CategoryId | null;
  /** 읽음 거르기(주소의 ?read=). null이면 전체 */
  readFilter: LibraryReadFilter | null;
  /** 검색어(주소의 ?q=, 제목·요약·출처). null이면 검색 안 함 */
  query: string | null;
  /** 검색어에 맞는 소식 수(검색 안 하면 total과 같다) */
  matchedTotal: number;
  /** 지금 카테고리 안에서 전체·안 읽음 수(들은 것도 읽음) */
  readCounts: { all: number; unread: number };
  /** 골라 듣기 '전체': 지금 거른 소식 전부(모든 쪽, 최신순). 안 읽은 것만 고르려면 '안 읽음'으로 거른 뒤 전체 */
  pickIds: number[];
  /** 받은 소식에 있는 카테고리와 개수 */
  categories: { id: CategoryId; label: string; count: number }[];
  /** 이 페이지의 소식을 피드 날짜별로 묶은 것 */
  groups: { date: string; label: string; entries: LibraryEntry[] }[];
}

/** 관심 토픽 고치기 결과(설정 화면 안내 문구) */
/** 관심사 고치기 결과. ok는 들어감(message는 한도로 일부만 들어갔을 때만), warn은 막힘. 성공 안내 문구는 없다(목록에 보인다) */
export type TopicResult = { tone: 'ok' | 'warn'; message: string; /** 막힌 까닭(온보딩이 알맞은 안내를 고른다, 링크는 분석 이벤트에 남긴다) */ code?: 'adult' | LinkError };

export interface UserTopic {
  /** 기타(목록에 없어 직접 적은 관심사)인지 */
  custom?: boolean;
  /** 내 관심 링크(토픽 's-<sources.id>')인지 */
  link?: boolean;
  id: string;
  name: string;
}

/** 설정 > 내 관심 링크 칸 하나에 든 링크 */
export interface LinkView {
  /** 토픽 id('s-<sources.id>'). 빼기는 이 id로 */
  id: string;
  /** 칸 번호(1부터). 설정 화면의 인풋박스 자리 */
  slot: number;
  name: string;
  /** 사용자가 넣은 사이트 주소(목록에서 여는 곳) */
  siteUrl: string;
  /** '3일 전' 같은 마지막 글 시점. 모르면 null */
  lastItemLabel: string | null;
  /** 최근 수집이 계속 실패하는지(설정 목록에 알린다) */
  failing: boolean;
}

/** 설정 > 관심사: 관심 분야와 그 아래 상세 관심사 */
export interface TopicGroupView {
  id: string;
  name: string;
  picked: boolean;
  details: { id: string; name: string; picked: boolean }[];
}
