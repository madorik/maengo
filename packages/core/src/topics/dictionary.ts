import type { Job, Topic } from '../types';

// 토픽 사전 v0. 런칭 전에 50개로 늘리고 supabase/seed.sql로 옮긴다(PLAN.md 11장 Day 2).
export const TOPICS: Topic[] = [
  { id: 'llm-agent', name: 'LLM 에이전트', aliases: ['에이전트', 'agent', 'AI 에이전트', '멀티 에이전트'] },
  { id: 'rag', name: 'RAG', aliases: ['검색 증강', '벡터 검색'] },
  { id: 'llm-dev', name: 'LLM 개발', aliases: ['LLM', 'LLM API', '생성형 AI', 'Gemini', 'GPT', '언어 모델'] },
  { id: 'prompt', name: '프롬프트 설계', aliases: ['프롬프트 엔지니어링', 'prompt'] },
  { id: 'ai-tools', name: 'AI 도구', aliases: ['AI 툴', '코딩 어시스턴트', 'AI 코딩', '코파일럿'] },
  { id: 'speech-ai', name: '음성 AI', aliases: ['TTS', 'STT', '음성 합성'] },
  { id: 'backend-perf', name: '백엔드 성능', aliases: ['성능 튜닝', '레이턴시', '서버 성능', '캐시', '트래픽'] },
  { id: 'database', name: '데이터베이스', aliases: ['DB', 'SQL'] },
  { id: 'postgres', name: 'PostgreSQL', aliases: ['포스트그레스', 'postgres'] },
  { id: 'observability', name: '관측성', aliases: ['모니터링', '트레이싱', 'observability', '로그'] },
  { id: 'kubernetes', name: '쿠버네티스', aliases: ['k8s', 'kubernetes', '컨테이너', '도커', '인프라'] },
  { id: 'security', name: '보안', aliases: ['공급망 보안', '취약점'] },
  { id: 'react', name: 'React', aliases: ['리액트', '서버 컴포넌트', 'Next.js', '프론트엔드'] },
  { id: 'web-perf', name: '웹 성능', aliases: ['Core Web Vitals', '로딩 속도', '프론트엔드 성능', '렌더링'] },
  { id: 'mobile-app', name: '모바일 앱', aliases: ['iOS', 'Android', '앱 성능', '안드로이드', '모바일'] },
  { id: 'data-eng', name: '데이터 엔지니어링', aliases: ['데이터 파이프라인', 'ETL'] },
  { id: 'design-system', name: '디자인 시스템', aliases: ['디자인 토큰', '컴포넌트 라이브러리', 'UI 디자인', '피그마'] },
  { id: 'product', name: '프로덕트 관리', aliases: ['PM', '우선순위', '기획', '프로덕트'] },
  { id: 'growth', name: '그로스', aliases: ['그로스 마케팅', '퍼널', '마케팅', '전환율'] },
  { id: 'career', name: '개발자 커리어', aliases: ['이직', '면접', '연봉'] },
  { id: 'remote-work', name: '원격 근무', aliases: ['워케이션', '디지털 노마드'] },
  { id: 'tech-biz', name: '테크 비즈니스', aliases: ['AI 비즈니스', '클라우드 비용', '가격 정책'] },
];

export const TOPIC_BY_ID: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.id, t]));

export interface JobInfo {
  label: string;
  /** "왜 중요한가" 문구의 앞머리. 받침에 따라 '라면'/'이라면'이 달라서 직접 적는다. */
  whyLead: string;
}

export const JOB_INFO: Record<Job, JobInfo> = {
  backend: { label: '백엔드 개발자', whyLead: '백엔드 개발자라면' },
  frontend: { label: '프론트엔드 개발자', whyLead: '프론트엔드 개발자라면' },
  mobile: { label: '모바일 개발자', whyLead: '모바일 개발자라면' },
  data: { label: '데이터 엔지니어', whyLead: '데이터 엔지니어라면' },
  infra: { label: '인프라 엔지니어', whyLead: '인프라 엔지니어라면' },
  pm: { label: 'PM', whyLead: 'PM이라면' },
  design: { label: '디자이너', whyLead: '디자이너라면' },
  marketing: { label: '마케터', whyLead: '마케터라면' },
  student: { label: '학생', whyLead: '공부하는 중이라면' },
  other: { label: '직장인', whyLead: '이 분야에 관심이 있다면' },
};

/** 직업별 추천 토픽. 1~3위는 온보딩에서 기본 선택된다. */
export const JOB_TOPICS: Record<Job, string[]> = {
  backend: ['llm-agent', 'rag', 'backend-perf', 'database', 'observability'],
  frontend: ['react', 'web-perf', 'ai-tools', 'design-system', 'llm-dev'],
  mobile: ['mobile-app', 'ai-tools', 'llm-dev', 'web-perf', 'security'],
  data: ['data-eng', 'database', 'rag', 'llm-dev', 'postgres'],
  infra: ['kubernetes', 'observability', 'security', 'backend-perf', 'ai-tools'],
  pm: ['product', 'ai-tools', 'llm-agent', 'growth', 'design-system'],
  design: ['design-system', 'ai-tools', 'product', 'web-perf', 'speech-ai'],
  marketing: ['growth', 'ai-tools', 'product', 'speech-ai', 'llm-agent'],
  student: ['llm-dev', 'ai-tools', 'react', 'backend-perf', 'database'],
  other: ['ai-tools', 'llm-agent', 'product', 'speech-ai', 'growth'],
};

/** 직업 추천 토픽 중 고르지 않은 것에 주는 가중치(PLAN.md 5.2). 관심사가 좁아도 첫 피드 5개를 채운다. */
export const JOB_PRIOR_WEIGHT = 0.3;

export function initialTopicWeights(job: Job, picked: string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const id of JOB_TOPICS[job]) weights[id] = JOB_PRIOR_WEIGHT;
  for (const id of picked) if (TOPIC_BY_ID.has(id)) weights[id] = 1;
  return weights;
}
