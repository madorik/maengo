import type { Topic } from '../types';

// 토픽 사전 v1(2026-10-10). 큰 분류 5개 + 그 아래 상세 관심사(언어·프레임워크·클라우드는 공식 블로그·릴리스 피드로 수집).
// - 처음 들어오면 큰 분류만 고른다(/onboarding). 상세 관심사는 설정에서 더한다.
// - 상세 관심사로 태그된 소식은 큰 분류에도 같이 태그한다(withParents). 그래서 "백엔드"만 골라도 PostgreSQL 소식을 받는다.
// - DB topics 표와 같아야 한다(supabase/migrations/…_topic_groups.sql).

/** 큰 분류. 처음 고르는 화면의 순서 */
export const TOPIC_GROUPS: Topic[] = [
  { id: 'ai', name: 'AI', aliases: ['인공지능', '생성형 AI', '머신러닝', 'ChatGPT', 'Gemini', 'Claude'] },
  { id: 'backend', name: '백엔드', aliases: ['서버', '서버 개발', 'API', '인프라', '클라우드', 'DevOps'] },
  { id: 'frontend', name: '프론트엔드', aliases: ['웹 개발', '자바스크립트', 'JavaScript', 'UI 개발'] },
  { id: 'realestate', name: '부동산', aliases: ['아파트', '집값', '주택', '분양', '부동산 시장'] },
  { id: 'stock', name: '주식', aliases: ['증시', '코스피', '코스닥', '나스닥', '주식 투자', '종목'] },
];

/** 상세 관심사(설정에서 더한다) */
const DETAILS: Topic[] = [
  // 백엔드: 언어·프레임워크
  { id: 'spring', name: 'Spring', aliases: ['스프링', 'Spring Boot', '스프링 부트', 'Spring Framework'], parent: 'backend' },
  { id: 'fastapi', name: 'FastAPI', aliases: ['패스트API'], parent: 'backend' },
  { id: 'java', name: 'Java', aliases: ['자바', 'JDK', 'OpenJDK', 'JVM'], parent: 'backend' },
  { id: 'kotlin', name: 'Kotlin', aliases: ['코틀린'], parent: 'backend' },
  { id: 'python', name: 'Python', aliases: ['파이썬', 'CPython', 'PyPI'], parent: 'backend' },
  // 백엔드: 클라우드
  { id: 'aws', name: 'AWS', aliases: ['아마존 웹 서비스', 'Amazon Web Services', 'EC2', 'S3', 'Lambda'], parent: 'backend' },
  { id: 'azure', name: 'Azure', aliases: ['애저', 'Microsoft Azure'], parent: 'backend' },
  { id: 'gcp', name: 'Google Cloud', aliases: ['GCP', '구글 클라우드', 'BigQuery', 'Cloud Run'], parent: 'backend' },
  // 백엔드: 운영·데이터
  { id: 'backend-perf', name: '백엔드 성능', aliases: ['성능 튜닝', '레이턴시', '서버 성능', '캐시', '트래픽'], parent: 'backend' },
  { id: 'database', name: '데이터베이스', aliases: ['DB', 'SQL'], parent: 'backend' },
  { id: 'postgres', name: 'PostgreSQL', aliases: ['포스트그레스', 'postgres'], parent: 'backend' },
  { id: 'kubernetes', name: '쿠버네티스', aliases: ['k8s', 'kubernetes', '컨테이너', '도커'], parent: 'backend' },
  { id: 'observability', name: '관측성', aliases: ['모니터링', '트레이싱', 'observability', '로그'], parent: 'backend' },
  { id: 'security', name: '보안', aliases: ['공급망 보안', '취약점', '해킹'], parent: 'backend' },
  { id: 'data-eng', name: '데이터 엔지니어링', aliases: ['데이터 파이프라인', 'ETL'], parent: 'backend' },
  // 프론트엔드
  { id: 'react', name: 'React', aliases: ['리액트', '서버 컴포넌트', 'React Native'], parent: 'frontend' },
  { id: 'nextjs', name: 'Next.js', aliases: ['넥스트', 'App Router', 'Vercel'], parent: 'frontend' },
  { id: 'vue', name: 'Vue', aliases: ['뷰', 'Vue.js', 'Nuxt'], parent: 'frontend' },
  { id: 'typescript', name: 'TypeScript', aliases: ['타입스크립트'], parent: 'frontend' },
  { id: 'web-perf', name: '웹 성능', aliases: ['Core Web Vitals', '로딩 속도', '프론트엔드 성능', '렌더링'], parent: 'frontend' },
  { id: 'design-system', name: '디자인 시스템', aliases: ['디자인 토큰', '컴포넌트 라이브러리', 'UI 디자인', '피그마'], parent: 'frontend' },
  { id: 'mobile-app', name: '모바일 앱', aliases: ['iOS', 'Android', '앱 성능', '안드로이드'], parent: 'frontend' },
  // AI
  { id: 'llm-dev', name: 'LLM', aliases: ['LLM 개발', 'LLM API', '언어 모델', '거대 언어 모델', '오픈소스 모델'], parent: 'ai' },
  { id: 'rag', name: 'RAG', aliases: ['검색 증강', '벡터 검색', '벡터 DB'], parent: 'ai' },
  { id: 'fine-tuning', name: '파인튜닝', aliases: ['fine-tuning', '미세 조정', 'LoRA', '학습 데이터'], parent: 'ai' },
  { id: 'llm-agent', name: 'LLM 에이전트', aliases: ['에이전트', 'agent', 'AI 에이전트', '멀티 에이전트'], parent: 'ai' },
  { id: 'prompt', name: '프롬프트 설계', aliases: ['프롬프트 엔지니어링', 'prompt'], parent: 'ai' },
  { id: 'ai-tools', name: 'AI 도구', aliases: ['AI 툴', '코딩 어시스턴트', 'AI 코딩', '코파일럿'], parent: 'ai' },
  { id: 'speech-ai', name: '음성 AI', aliases: ['TTS', 'STT', '음성 합성'], parent: 'ai' },
  // 부동산
  { id: 're-subscription', name: '청약·분양', aliases: ['청약', '분양가', '청약 경쟁률', '특별공급'], parent: 'realestate' },
  { id: 're-policy', name: '부동산 정책·세금', aliases: ['부동산 대책', '대출 규제', 'DSR', '종부세', '양도세', '취득세'], parent: 'realestate' },
  { id: 're-rent', name: '전월세', aliases: ['전세', '월세', '전세 사기', '임대차'], parent: 'realestate' },
  { id: 're-redevelop', name: '재건축·재개발', aliases: ['재건축', '재개발', '정비사업', '리모델링'], parent: 'realestate' },
  // 주식
  { id: 'stock-kr', name: '국내 주식', aliases: ['코스피', '코스닥', '국내 증시', '삼성전자'], parent: 'stock' },
  { id: 'stock-us', name: '미국 주식', aliases: ['나스닥', 'S&P500', '뉴욕 증시', '미국 증시', '엔비디아'], parent: 'stock' },
  { id: 'etf', name: 'ETF·연금 투자', aliases: ['ETF', '연금저축', 'IRP', 'ISA', '배당'], parent: 'stock' },
  { id: 'ipo', name: '공모주', aliases: ['IPO', '상장', '수요예측'], parent: 'stock' },
  { id: 'macro', name: '금리·환율', aliases: ['기준금리', '환율', '금리', '연준', 'FOMC', '물가'], parent: 'stock' },
];

export const TOPICS: Topic[] = [...TOPIC_GROUPS, ...DETAILS];

export const TOPIC_BY_ID: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.id, t]));

/** 큰 분류 아래 상세 관심사 */
export function childrenOf(groupId: string): Topic[] {
  return DETAILS.filter((t) => t.parent === groupId);
}

/** 큰 분류 id(상세 관심사면 그 부모, 큰 분류면 자기 자신) */
export function groupOf(topicId: string): string {
  return TOPIC_BY_ID.get(topicId)?.parent ?? topicId;
}

/**
 * 상세 관심사 태그에 큰 분류 태그를 더한다. 큰 분류의 관련도는 자식 중 가장 높은 값(이미 있으면 더 큰 쪽).
 * 결과는 관련도 높은 순.
 */
export function withParents(tags: { topicId: string; relevance: number }[]): { topicId: string; relevance: number }[] {
  const out = new Map<string, number>();
  for (const t of tags) {
    out.set(t.topicId, Math.max(out.get(t.topicId) ?? 0, t.relevance));
    const parent = TOPIC_BY_ID.get(t.topicId)?.parent;
    if (parent) out.set(parent, Math.max(out.get(parent) ?? 0, t.relevance));
  }
  return [...out].map(([topicId, relevance]) => ({ topicId, relevance })).sort((a, b) => b.relevance - a.relevance);
}

/** 고른 토픽은 가중치 1.0. 사전에 없는 id는 버린다 */
export function initialTopicWeights(picked: string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const id of picked) if (TOPIC_BY_ID.has(id)) weights[id] = 1;
  return weights;
}

/** "왜 중요한가" 문구의 앞머리. 직업 대신 관심 토픽으로 말한다: 'RAG에 관심 있다면' */
export function whyLead(topicName: string): string {
  return `${topicName}에 관심 있다면`;
}
