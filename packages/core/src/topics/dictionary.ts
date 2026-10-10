import type { Topic } from '../types';

// 토픽 사전 v2(2026-10-10). 주기적으로 새 소식·데이터가 생기는 분야 8개 + 그 아래 상세 관심사.
// - 처음 들어오면 큰 분류만 고른다(/onboarding). 상세 관심사는 설정에서 더한다. 목록에 없는 건 기타(custom 토픽)로 적는다.
// - 상세 관심사로 태그된 소식은 큰 분류에도 같이 태그한다(withParents). 그래서 "개발"만 골라도 Spring 릴리즈 소식을 받는다.
// - 이름·별칭으로 토픽 벡터를 만들고(tag 단계), 직접 적은 말을 사전에 연결한다(findTopicByName). 이름은 서로 겹치지 않게 둔다.
// - DB topics 표와 같아야 한다(supabase/migrations/…_topics_v2.sql).

/** 큰 분류. 처음 고르는 화면의 순서 */
export const TOPIC_GROUPS: Topic[] = [
  { id: 'ai', name: 'AI', aliases: ['인공지능', '생성형 AI', '머신러닝', 'ChatGPT', 'Gemini', 'Claude'] },
  { id: 'stock', name: '주식', aliases: ['증시', '주식 투자', '종목', '주가', '증권'] },
  { id: 'coin', name: '코인', aliases: ['암호화폐', '가상자산', '가상화폐', '크립토', '블록체인'] },
  { id: 'chip-robot', name: '반도체·로봇', aliases: ['반도체 산업', '로봇 산업', '첨단 산업', '하드웨어'] },
  { id: 'dev', name: '개발', aliases: ['소프트웨어 개발', '프로그래밍', '개발자', '백엔드', '프론트엔드', 'DevOps'] },
  { id: 'kpop', name: 'K-Pop', aliases: ['케이팝', 'KPOP', '아이돌', '가요'] },
  { id: 'kbeauty', name: 'K-뷰티', aliases: ['K뷰티', '케이뷰티', '화장품', '뷰티', '코스메틱'] },
  { id: 'kfood', name: 'K-푸드', aliases: ['K푸드', '케이푸드', '식품', '먹거리'] },
];

/** 상세 관심사(설정에서 더한다) */
const DETAILS: Topic[] = [
  // AI
  { id: 'llm-dev', name: 'LLM', aliases: ['새 모델', '언어 모델', '거대 언어 모델', '오픈소스 모델', 'LLM API'], parent: 'ai' },
  { id: 'vibe-coding', name: '바이브코딩', aliases: ['바이브 코딩', 'vibe coding', 'AI 코딩', '코딩 에이전트', 'Claude Code', 'Cursor', 'Copilot', '코파일럿'], parent: 'ai' },
  { id: 'llm-agent', name: 'AI 에이전트', aliases: ['에이전트', 'agent', 'LLM 에이전트', '멀티 에이전트', 'MCP'], parent: 'ai' },
  { id: 'ai-automation', name: '업무 자동화', aliases: ['자동화', '워크플로 자동화', '노코드', 'n8n', 'RPA', 'AI 업무'], parent: 'ai' },
  { id: 'rag', name: 'RAG', aliases: ['검색 증강', '벡터 검색', '벡터 DB'], parent: 'ai' },
  { id: 'gen-media', name: '이미지·영상 생성', aliases: ['이미지 생성', '영상 생성', '동영상 생성', 'Sora', 'Midjourney', '미드저니', 'Veo'], parent: 'ai' },
  // 주식
  { id: 'kospi', name: '코스피', aliases: ['KOSPI', '유가증권시장', '국내 증시'], parent: 'stock' },
  { id: 'kosdaq', name: '코스닥', aliases: ['KOSDAQ', '코스닥 시장'], parent: 'stock' },
  { id: 'stock-us', name: '미국 주식', aliases: ['나스닥', 'S&P500', '뉴욕 증시', '미국 증시', '다우'], parent: 'stock' },
  { id: 'macro', name: '금리·환율', aliases: ['기준금리', '환율', '금리', '연준', 'FOMC', '물가'], parent: 'stock' },
  { id: 'etf', name: 'ETF', aliases: ['상장지수펀드', '연금저축', 'IRP', 'ISA', '배당'], parent: 'stock' },
  { id: 'ipo', name: '공모주', aliases: ['IPO', '상장', '수요예측'], parent: 'stock' },
  // 코인
  { id: 'bitcoin', name: '비트코인', aliases: ['BTC', '비트코인 ETF', '비트코인 가격'], parent: 'coin' },
  { id: 'ethereum', name: '이더리움', aliases: ['ETH', '이더', '이더리움 ETF'], parent: 'coin' },
  { id: 'stablecoin', name: '스테이블코인', aliases: ['스테이블 코인', 'USDT', 'USDC', '테더', '원화 스테이블코인'], parent: 'coin' },
  { id: 'crypto-reg', name: '가상자산 규제', aliases: ['가상자산법', '코인 규제', '거래소 규제', '디지털자산기본법'], parent: 'coin' },
  // 반도체·로봇
  { id: 'semiconductor', name: '반도체', aliases: ['HBM', '메모리 반도체', '파운드리', '엔비디아', 'TSMC', 'SK하이닉스', 'AI 칩', 'GPU'], parent: 'chip-robot' },
  { id: 'robot', name: '로봇·휴머노이드', aliases: ['로봇', '휴머노이드', '피지컬 AI', '로보틱스', '산업용 로봇'], parent: 'chip-robot' },
  { id: 'ev-battery', name: '전기차·배터리', aliases: ['전기차', '배터리', '2차전지', '이차전지', 'EV', '자율주행'], parent: 'chip-robot' },
  // 개발(언어·프레임워크·클라우드는 공식 블로그·릴리즈 피드로 수집)
  {
    id: 'dev-release',
    name: '언어·프레임워크 릴리즈',
    aliases: ['릴리즈', '릴리스', '새 버전', 'Spring', '스프링', 'Spring Boot', '스프링 부트', 'FastAPI', 'Java', '자바', 'Kotlin', '코틀린', 'Python', '파이썬', 'React', '리액트', 'Next.js', 'Vue', 'TypeScript', '타입스크립트', 'PostgreSQL'],
    parent: 'dev',
  },
  { id: 'cloud', name: '클라우드', aliases: ['AWS', 'Azure', '애저', 'GCP', 'Google Cloud', '구글 클라우드', '쿠버네티스', 'Kubernetes', '서버리스'], parent: 'dev' },
  { id: 'security', name: '보안', aliases: ['해킹', '취약점', 'CVE', '개인정보 유출', '랜섬웨어', '공급망 보안'], parent: 'dev' },
  // K-Pop
  { id: 'kpop-release', name: '컴백·신곡', aliases: ['컴백', '신곡', '앨범', '뮤직비디오', '데뷔'], parent: 'kpop' },
  { id: 'kpop-chart', name: '음원 차트', aliases: ['차트', '멜론 차트', '빌보드', '음원 순위', '음반 판매량'], parent: 'kpop' },
  { id: 'kpop-concert', name: '콘서트·투어', aliases: ['콘서트', '월드투어', '투어', '팬미팅', '공연'], parent: 'kpop' },
  // K-뷰티(신제품은 K-푸드와 이름이 겹치지 않게 화장품으로 적는다)
  { id: 'beauty-new', name: '화장품 신제품', aliases: ['뷰티 신제품', '신상 화장품', '스킨케어 신제품'], parent: 'kbeauty' },
  { id: 'beauty-trend', name: '뷰티 랭킹·트렌드', aliases: ['올리브영', '뷰티 트렌드', '화장품 랭킹', '뷰티 랭킹'], parent: 'kbeauty' },
  { id: 'beauty-export', name: '뷰티 브랜드·수출', aliases: ['화장품 수출', 'K뷰티 수출', '인디 브랜드', '아모레퍼시픽', 'LG생활건강'], parent: 'kbeauty' },
  // K-푸드
  { id: 'food-new', name: '편의점·식품 신상', aliases: ['편의점 신상', '식품 신제품', '라면 신제품', '과자 신제품'], parent: 'kfood' },
  { id: 'food-franchise', name: '외식·프랜차이즈', aliases: ['프랜차이즈', '외식', '배달', '카페', '치킨'], parent: 'kfood' },
  { id: 'food-export', name: 'K-푸드 수출', aliases: ['식품 수출', '라면 수출', '불닭', '한식 세계화'], parent: 'kfood' },
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
