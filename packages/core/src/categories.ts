// 글 카테고리. 토픽(세부 관심사)과 달리 "이 글이 어떤 종류의 글인가"를 넓게 나눈다.
// 실제로는 요약 단계에서 AI가 이 목록 중 하나를 고른다(structured output enum).
// 키가 없을 때는 아래 키워드 분류기로 대신한다.

export const CATEGORIES = [
  { id: 'ai', label: 'AI' },
  { id: 'tech', label: '테크' },
  { id: 'design', label: '디자인' },
  { id: 'business', label: '비즈니스' },
  { id: 'marketing', label: '마케팅' },
  { id: 'career', label: '커리어' },
  { id: 'finance', label: '경제·주식' },
  { id: 'crypto', label: '코인' },
  { id: 'entertainment', label: '연예' },
  { id: 'beauty', label: '뷰티' },
  { id: 'food', label: '푸드' },
  // 관심 분야에서는 뺐지만(2026-10-10) 이미 요약된 글과 경제 기사 속 부동산 소식에 남는다
  { id: 'realestate', label: '부동산' },
  { id: 'science', label: '과학' },
  { id: 'travel', label: '여행' },
  { id: 'life', label: '라이프' },
  { id: 'etc', label: '기타' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<CategoryId, string>;

export function isCategory(v: unknown): v is CategoryId {
  return typeof v === 'string' && (CATEGORY_IDS as string[]).includes(v);
}

// 너무 흔한 말(API, 화면, 코드)은 넣지 않는다. 어디에나 나와서 분류를 흐린다.
const KEYWORDS: Record<Exclude<CategoryId, 'etc'>, string[]> = {
  ai: ['ai', 'llm', 'gemini', 'gpt', '모델', '에이전트', 'rag', '프롬프트', '임베딩', '생성형', 'tts', '음성 합성', '벡터', '챗봇', '대화', '답변', '정답셋', '평가셋', '토큰'],
  tech: ['postgresql', 'redis', '쿠버네티스', '서버', '인덱스', '데이터베이스', 'db', '파이프라인', '배포', 'react', '트레이스', '로그', '보안', '패키지', '앱', 'sdk', '캐시', '커넥션', '장애', '쿼리', '성능', '레이트 리밋', '폰트', '컴포넌트', '반도체', 'hbm', '로봇', '휴머노이드', '배터리', '전기차'],
  design: ['디자인', '피그마', 'ui', 'ux', '여백', '정렬', '디자인 토큰', '타이포'],
  business: ['우선순위', '프로덕트', '스타트업', '투자', '매출', '고객', '가격', '과금', '요금제', '정액제', '임팩트'],
  marketing: ['마케팅', '퍼널', '그로스', '전환', '광고', '이탈'],
  career: ['면접', '이직', '연봉', '커리어', '채용', '이력서', '시니어', '주니어'],
  finance: ['환율', '달러', '금리', '물가', '주식', '경제', '예산', '증시', '코스피', '코스닥', '나스닥', '실적', '배당', 'etf'],
  crypto: ['코인', '비트코인', '이더리움', '가상자산', '암호화폐', '스테이블코인', '블록체인', '거래소', '알트코인'],
  entertainment: ['컴백', '아이돌', '앨범', '콘서트', '케이팝', 'k-pop', '음원', '팬미팅', '데뷔', '걸그룹', '보이그룹'],
  beauty: ['화장품', '뷰티', '스킨케어', '올리브영', '코스메틱', '메이크업', '선크림'],
  food: ['식품', '라면', '편의점', '외식', '프랜차이즈', '음료', '과자', '치킨', '디저트'],
  realestate: ['부동산', '아파트', '청약', '분양', '전세', '월세', '재건축', '재개발', '집값', '주택'],
  science: ['연구', '논문', '우주', '과학', '실험', '물리'],
  travel: ['여행', '항공', '숙소', '도시', '워케이션', '관광', '비자'],
  life: ['건강', '운동', '수면', '요리', '취미', '육아'],
};

function count(text: string, word: string): number {
  let n = 0;
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + word.length)) n++;
  return n;
}

/** 제목은 세 배, 요약은 두 배로 센다. 아무 단어도 안 걸리면 기타 */
export function classifyByKeywords(input: { title: string; short: string; body: string[] }): CategoryId {
  const title = input.title.toLowerCase();
  const short = input.short.toLowerCase();
  const body = input.body.join(' ').toLowerCase();
  let best: CategoryId = 'etc';
  let bestScore = 0;
  for (const [id, words] of Object.entries(KEYWORDS) as [CategoryId, string[]][]) {
    const score = words.reduce((s, w) => s + 3 * count(title, w) + 2 * count(short, w) + count(body, w), 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}
