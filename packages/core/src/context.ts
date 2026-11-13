// 내 맞춤 정보(2026-11-11 사용자): 받은 소식과 관계있는 질문을 가끔 하나씩 딸깍으로 묻고(주식 소식 → '주식 하세요?' → '국내·미국?'),
// 모은 답으로 그 소식이 이 사람에게 무슨 뜻인지 짚는다(lib/server/briefing-insight.ts 맞춤 체크). 저장은 user_context(lib/server/user-context.ts).
// 서버·화면·파이프라인 공용(2026-11-11 주간 리포트에서도 쓰려고 apps/web/lib/context.ts에서 옮김. 웹은 그 파일이 다시 내보낸다)

/** 질문을 고를 때 보는 소식(제목·요약만) */
export type ContextItem = { title: string; short: string };

export interface ContextOption {
  value: string;
  label: string;
  /** 인사이트에 주는 말(예: '국내 주식을 해요') */
  fact: string;
  /** 고르면 비중을 켜는 상세 관심사(topics 사전 id). 그 주제 소식을 더 받는다(2026-11-12, lib/server/user-context.ts) */
  topic?: string;
}

export interface ContextQuestion {
  key: string;
  /** 묻는 말 */
  ask: string;
  options: ContextOption[];
  /** 받은 소식 제목·요약에 이 말이 있으면 묻는다 */
  trigger: RegExp;
  /** 이 답 뒤에 이어 묻는다(그 답일 때만). 이어 묻는 질문은 같은 브리핑에서도 바로 */
  after?: { key: string; value: string };
  /** 질문 앞의 작은 말(무슨 소식 때문에 묻는지) */
  about: string;
  /** 설정 > 맞춤 인사이트 > 내 맞춤 정보에서 묶는 분야 */
  group: ContextGroup;
  /** 여러 개를 고른다(값은 쉼표로 이은 것, 예: 'kr_stock,us_stock') */
  multi?: true;
  /** 여러 개를 고를 때 최대 개수(없으면 제한 없음) */
  max?: number;
  /** 온보딩에서만 묻는다(기사 아래에서는 묻지 않는다, 2026-11-12) */
  onboarding?: true;
  /** 온보딩 한 페이지에서 이 질문을 보여 줄 분야(sections.ts SectionId) */
  section?: string;
  /** 온보딩 묶음 이름(없으면 분야 이름). 예: AI(분야는 IT/과학) */
  title?: string;
  /** 온보딩 묶음 머리의 오늘 화제 소식 자리(onboarding-picks.ts, 없으면 분야) */
  pick?: string;
}

/** 분야(설정에서 이 차례로 묶어 보인다). 정치는 묻지 않는다(정치 성향은 민감정보) — 정치 소식은 사는 곳·나이대·자녀·일하는 형태로 짚는다 */
export const CONTEXT_GROUPS = ["경제", "부동산", "IT/과학", "사회", "세계", "스포츠", "엔터", "생활/문화"] as const;
export type ContextGroup = (typeof CONTEXT_GROUPS)[number];

const STOCK = /주식|코스피|코스닥|증시|주가|나스닥|S&P|다우|공모주|ETF|반도체주|상장/;
const HOUSE = /부동산|아파트|집값|전세|월세|청약|재건축|재개발|분양|주택|임대차/;
const FUEL = /유가|기름값|휘발유|경유|주유/;

/**
 * 질문 목록. 한 소식에 여러 질문이 걸리면 위에 있는 것부터 묻는다(하루에 새 질문 하나).
 * 2026-11-11 사용자: 분야별 질문 전체 + 나이대에 20대. 묻지 않는 것: 정치 성향·종교·건강·노조(민감정보), 정확한 금액·종목·주소·나이
 */
export const CONTEXT_QUESTIONS: ContextQuestion[] = [
  // 요즘 신경 쓰는 경제 부문(2026-11-13, 화면 글에 '돈'은 쓰지 않는다): 카드를 누르면 분야를 통째로 고르게 되어 '관심'만으로는 무엇을 먼저 짚을지 알 수 없었다.
  // 온보딩 카드 다음 한 화면에서 고르게 한다. 개수 제한은 없다(2026-11-13 사용자 '관심사 제한 두지마, 많이 알수록 인사이트 분석하기 좋다', 처음엔 2개까지였다)(맹고-문서/오늘의-흐름.md '맞춤 정보 검토'). 가진 것을 묻지 않고 '신경 쓰는 것'으로 묻는다.
  // topic: 고르면 그 주제 소식을 브리핑에서 더 받는다(분야 id는 걸지 않는다. 빼면 분야 비중이 지워진다)
  {
    key: "focus",
    ask: "요즘 신경 쓰는 경제 부문",
    about: "관심",
    trigger: /$^/,
    group: "경제",
    multi: true,
    onboarding: true,
    options: [
      { value: "kr_stock", label: "국내 주식", fact: "요즘 국내 주식을 신경 써요", topic: "kospi" },
      { value: "us_stock", label: "미국 주식", fact: "요즘 미국 주식을 신경 써요", topic: "stock-us" },
      { value: "crypto", label: "코인", fact: "요즘 코인을 신경 써요", topic: "coin" },
      // 환율(11-07~13 받은 소식의 6%가 환율에 닿았다. 해외 결제·수출입 일), 칸을 2×4로 맞춘다
      { value: "fx", label: "환율", fact: "요즘 환율을 신경 써요", topic: "macro" },
      { value: "deposit", label: "예적금", fact: "요즘 예적금 이자를 신경 써요", topic: "macro" },
      { value: "loan", label: "대출 이자", fact: "요즘 대출 이자를 신경 써요", topic: "macro" },
      { value: "home", label: "내 집 마련", fact: "요즘 내 집 마련을 신경 써요" },
      { value: "house_price", label: "집값", fact: "요즘 집값을 신경 써요" },
    ],
  },
  // 분야별 관심(선택지는 많이 고를 만한 것부터, 온보딩은 앞 3개만 먼저 보인다)
  // 2026-11-12 사용자: 온보딩 한 페이지에서 분야마다 고른다, 예민하지 않은 '관심'만. 정치는 묻지 않는다. 사회·생활/문화·스포츠·엔터·세계는 온보딩에서 뺐다). 여러 개, 기사 아래에서는 묻지 않는다
  {
    key: "int_economy",
    ask: "관심 있는 경제 이야기",
    about: "관심",
    trigger: /$^/,
    group: "경제",
    multi: true,
    onboarding: true,
    section: "economy",
    options: [
      { value: "kr_stock", label: "국내 주식", fact: "국내 주식에 관심 있어요" },
      { value: "us_stock", label: "미국 주식", fact: "미국 주식에 관심 있어요" },
      { value: "fx_rate", label: "환율·금리", fact: "환율·금리에 관심 있어요" },
      { value: "crypto", label: "코인", fact: "코인에 관심 있어요" },
      { value: "deposit", label: "예금·적금", fact: "예금·적금에 관심 있어요" },
      { value: "dividend", label: "금융·배당", fact: "금융·배당주에 관심 있어요" },
      { value: "tax", label: "세금·정책", fact: "세금·정책 변화(세법·예산·대출 규제·연금)에 관심 있어요", topic: "tax-policy" },
    ],
  },
  // AI(2026-11-12 사용자 'AI 관련된 것도 넣어줘'): 분야는 IT/과학, 온보딩에서는 따로 한 묶음. 2026-11-13 사용자 'AI에 로봇도 같이 넣어' → AI·로봇
  {
    key: "int_ai",
    ask: "관심 있는 AI·로봇 이야기",
    about: "관심",
    trigger: /$^/,
    group: "IT/과학",
    multi: true,
    onboarding: true,
    section: "it-science",
    title: "AI·로봇",
    pick: "ai",
    options: [
      { value: "model", label: "새 AI 모델", fact: "새 AI 모델(ChatGPT·Gemini·Claude 등) 소식에 관심 있어요", topic: "llm-dev" },
      { value: "invest", label: "AI 투자·관련주", fact: "AI 투자와 관련 기업 주가에 관심 있어요", topic: "ai" },
      { value: "service", label: "AI 서비스·앱", fact: "AI 서비스·앱에 관심 있어요", topic: "ai" },
      { value: "robot", label: "로봇", fact: "로봇·휴머노이드에 관심 있어요", topic: "robot" },
      { value: "work", label: "AI로 일하기", fact: "일에 AI를 쓰는 데 관심 있어요", topic: "ai-automation" },
      { value: "rules", label: "AI 규제·일자리", fact: "AI 규제와 일자리 변화에 관심 있어요" },
    ],
  },
  {
    key: "int_real_estate",
    ask: "관심 있는 부동산 이야기",
    about: "관심",
    trigger: /$^/,
    group: "부동산",
    multi: true,
    onboarding: true,
    section: "real-estate",
    options: [
      { value: "home", label: "내 집 마련", fact: "내 집 마련에 관심 있어요" },
      { value: "price", label: "집값 흐름", fact: "집값 흐름에 관심 있어요" },
      { value: "apply", label: "청약", fact: "청약에 관심 있어요" },
      { value: "rebuild", label: "재건축·재개발", fact: "재건축·재개발에 관심 있어요" },
    ],
  },
  {
    key: "int_it_science",
    ask: "관심 있는 산업",
    about: "관심",
    trigger: /$^/,
    group: "IT/과학",
    multi: true,
    onboarding: true,
    section: "it-science",
    options: [
      { value: "semis", label: "반도체", fact: "반도체 산업에 관심 있어요" },
      { value: "bigtech", label: "빅테크", fact: "빅테크(애플·구글·엔비디아 등)에 관심 있어요" },
      { value: "battery", label: "2차전지", fact: "2차전지 산업에 관심 있어요" },
      { value: "auto", label: "자동차·모빌리티", fact: "자동차·모빌리티 산업에 관심 있어요" },
      { value: "bio", label: "바이오", fact: "바이오 산업에 관심 있어요" },
      { value: "phone", label: "스마트폰", fact: "스마트폰에 관심 있어요" },
    ],
  },
  // 경제
  {
    key: "stock",
    ask: "주식 하세요?",
    about: "주식 소식",
    group: "경제",
    trigger: STOCK,
    options: [
      { value: "yes", label: "해요", fact: "주식을 해요" },
      { value: "no", label: "안 해요", fact: "주식은 안 해요" },
    ],
  },
  {
    key: "stock_market",
    ask: "주로 어디 주식이에요?",
    about: "주식 소식",
    group: "경제",
    trigger: STOCK,
    after: { key: "stock", value: "yes" },
    options: [
      { value: "kr", label: "국내", fact: "국내 주식(국장)을 해요" },
      { value: "us", label: "미국", fact: "미국 주식(미장)을 해요" },
      { value: "both", label: "둘 다", fact: "국내·미국 주식을 다 해요" },
    ],
  },
  {
    key: "crypto",
    ask: "코인 하세요?",
    about: "코인 소식",
    group: "경제",
    trigger: /코인|비트코인|이더리움|가상자산|가상화폐|업비트|빗썸|바이낸스|리플/,
    options: [
      { value: "yes", label: "해요", fact: "코인을 해요" },
      { value: "no", label: "안 해요", fact: "코인은 안 해요" },
    ],
  },
  {
    key: "loan",
    ask: "대출이 있으세요?",
    about: "금리 소식",
    group: "경제",
    trigger: /금리|대출|기준금리|한국은행|한은|연준|FOMC|주담대|DSR|가계부채/,
    options: [
      { value: "variable", label: "변동금리", fact: "변동금리 대출이 있어요" },
      { value: "fixed", label: "고정금리", fact: "고정금리 대출이 있어요" },
      { value: "none", label: "없어요", fact: "대출이 없어요" },
    ],
  },
  // 부동산
  {
    key: "home",
    ask: "집은 어떤 상황이에요?",
    about: "부동산 소식",
    group: "부동산",
    trigger: HOUSE,
    options: [
      { value: "none", label: "무주택", fact: "무주택이에요" },
      { value: "one", label: "1주택", fact: "집이 한 채 있어요" },
      { value: "multi", label: "다주택", fact: "집이 두 채 이상 있어요" },
    ],
  },
  {
    key: "apply",
    ask: "청약 준비 중이세요?",
    about: "부동산 소식",
    group: "부동산",
    trigger: HOUSE,
    after: { key: "home", value: "none" },
    options: [
      { value: "yes", label: "준비 중", fact: "청약을 준비하고 있어요" },
      { value: "no", label: "아니요", fact: "청약은 준비하지 않아요" },
    ],
  },
  {
    key: "housing",
    ask: "지금 사는 집은요?",
    about: "부동산 소식",
    group: "부동산",
    trigger: HOUSE,
    options: [
      { value: "own", label: "자가", fact: "자기 집에 살아요" },
      { value: "jeonse", label: "전세", fact: "전세로 살아요" },
      { value: "monthly", label: "월세", fact: "월세로 살아요" },
    ],
  },
  // 생활/문화(출퇴근길 30~50대에게 자주 닿는 것부터)
  {
    key: "carrier",
    ask: "통신사는요?",
    about: "통신 소식",
    group: "생활/문화",
    trigger: /SKT|SK텔레콤|\bKT\b|LG유플러스|LGU\+|LG U\+|통신사|유심|요금제|알뜰폰|단말기/,
    options: [
      { value: "skt", label: "SKT", fact: "통신사는 SKT를 써요" },
      { value: "kt", label: "KT", fact: "통신사는 KT를 써요" },
      { value: "lgu", label: "LG U+", fact: "통신사는 LG U+를 써요" },
      { value: "mvno", label: "알뜰폰", fact: "알뜰폰을 써요" },
    ],
  },
  // 사회
  {
    key: "commute",
    ask: "출퇴근은 주로 뭘로 하세요?",
    about: "교통 소식",
    group: "사회",
    trigger: /지하철|버스|대중교통|교통|파업|통행료|고속도로|KTX|GTX|출퇴근|철도|유가|기름값/,
    options: [
      { value: "car", label: "자가용", fact: "자가용으로 출퇴근해요" },
      { value: "transit", label: "대중교통", fact: "대중교통으로 출퇴근해요" },
      { value: "walk", label: "걷기·자전거", fact: "걷거나 자전거로 출퇴근해요" },
    ],
  },
  {
    key: "car",
    ask: "자동차 있으세요?",
    about: "자동차 소식",
    group: "생활/문화",
    trigger: new RegExp(`${FUEL.source}|전기차|하이브리드|충전소|보조금|리콜|자동차|현대차|기아|테슬라|자동차보험`),
    options: [
      { value: "fuel", label: "휘발유·경유", fact: "휘발유·경유 차가 있어요" },
      { value: "ev", label: "전기·하이브리드", fact: "전기·하이브리드 차가 있어요" },
      { value: "none", label: "없어요", fact: "차는 없어요" },
    ],
  },
  {
    key: "overseas_pay",
    ask: "해외 결제·직구·여행 자주 하세요?",
    about: "환율 소식",
    group: "경제",
    trigger: /환율|원·달러|원달러|원화|달러|엔화|직구|해외여행|면세/,
    options: [
      { value: "often", label: "자주", fact: "해외 결제·직구·여행을 자주 해요" },
      { value: "sometimes", label: "가끔", fact: "해외 결제·직구·여행을 가끔 해요" },
      { value: "rarely", label: "거의 안 해요", fact: "해외 결제·직구·여행은 거의 안 해요" },
    ],
  },
  {
    key: "kids",
    ask: "자녀가 있으세요?",
    about: "교육·육아 소식",
    group: "사회",
    trigger: /보육|어린이집|유치원|육아|아동|학교|교육|수능|입시|학원|저출산|출산|돌봄|늘봄|학부모|초등|중학|고교|대학/,
    options: [
      { value: "none", label: "없어요", fact: "자녀는 없어요" },
      { value: "preschool", label: "미취학", fact: "미취학 자녀가 있어요" },
      { value: "school", label: "초중고", fact: "초중고 자녀가 있어요" },
      { value: "adult", label: "대학 이상", fact: "대학생 이상 자녀가 있어요" },
    ],
  },
  // IT/과학
  {
    key: "job",
    ask: "어떤 일을 하세요?",
    about: "일자리 소식",
    group: "IT/과학",
    trigger: /AI|인공지능|채용|구조조정|일자리|노동|임금|파업|고용|자동화|정년/,
    options: [
      { value: "it", label: "IT·개발", fact: "IT·개발 일을 해요" },
      { value: "finance", label: "금융", fact: "금융 일을 해요" },
      { value: "maker", label: "제조", fact: "제조업에서 일해요" },
      // 2026-11-13: 11-07~13 받은 소식의 업종 낱말에 바이오·건설이 자주 나와 더함, 물류·운송은 유가·관세·환율에 닿아 더함(온보딩 3×3)
      { value: "build", label: "건설·부동산", fact: "건설·부동산 분야에서 일해요" },
      { value: "bio", label: "의료·바이오", fact: "의료·바이오 분야에서 일해요" },
      { value: "logistics", label: "물류·운송", fact: "물류·운송 분야에서 일해요" },
      { value: "service", label: "서비스·유통", fact: "서비스·유통 일을 해요" },
      { value: "public", label: "공공·교육", fact: "공공·교육 분야에서 일해요" },
      { value: "etc", label: "기타", fact: "" },
    ],
  },
  {
    key: "dev_area",
    ask: "주로 다루는 쪽은요?",
    about: "IT 소식",
    group: "IT/과학",
    trigger: /AI|인공지능|클라우드|보안|해킹|취약점|오픈소스|개발자|API|서버|데이터센터|LLM|모델|앱/,
    after: { key: "job", value: "it" },
    options: [
      { value: "web_app", label: "웹·앱", fact: "웹·앱 개발을 해요" },
      { value: "infra", label: "서버·인프라", fact: "서버·인프라 일을 해요" },
      { value: "ai_data", label: "AI·데이터", fact: "AI·데이터 일을 해요" },
    ],
  },
  {
    key: "work_type",
    ask: "일하는 형태는요?",
    about: "일 소식",
    group: "사회",
    trigger: /최저임금|근로|노동|자영업|소상공인|프리랜서|주52시간|주4일|퇴직|연차|육아휴직|고용보험|종합소득세|임금/,
    options: [
      { value: "employee", label: "직장인", fact: "회사에 다녀요" },
      { value: "self", label: "자영업", fact: "자영업을 해요" },
      { value: "freelance", label: "프리랜서", fact: "프리랜서로 일해요" },
      { value: "etc", label: "그 밖", fact: "" },
    ],
  },
  {
    key: "age",
    ask: "나이대는요?",
    about: "연금·세대 소식",
    group: "사회",
    trigger: /연금|국민연금|기초연금|청년|중장년|은퇴|정년|노후|세대|MZ|건강보험/,
    options: [
      { value: "20s", label: "20대", fact: "20대예요" },
      { value: "30s", label: "30대", fact: "30대예요" },
      { value: "40s", label: "40대", fact: "40대예요" },
      { value: "50s", label: "50대", fact: "50대예요" },
      { value: "etc", label: "그 밖", fact: "" },
    ],
  },
  {
    key: "savings",
    ask: "주로 어떻게 모으세요?",
    about: "금리 소식",
    group: "경제",
    trigger: /금리|예금|적금|이자|기준금리|파킹통장|저축|한국은행|한은/,
    options: [
      { value: "deposit", label: "예적금", fact: "주로 예적금으로 모아요" },
      { value: "invest", label: "투자", fact: "주로 투자로 모아요" },
      { value: "both", label: "반반", fact: "예적금과 투자를 반반 해요" },
    ],
  },
  {
    key: "buy_plan",
    ask: "1~2년 안에 집 살 계획 있으세요?",
    about: "부동산 소식",
    group: "부동산",
    trigger: /집값|주담대|DSR|분양|아파트|매매|대출 규제|LTV/,
    options: [
      { value: "yes", label: "있어요", fact: "1~2년 안에 집을 살 계획이 있어요" },
      { value: "no", label: "없어요", fact: "당분간 집 살 계획은 없어요" },
    ],
  },
  {
    key: "region",
    ask: "주로 사는 곳은요?",
    about: "지역 소식",
    group: "부동산",
    trigger: /서울|경기|인천|수도권|지방|광역시|GTX|신도시|지자체|시장 선거|도지사/,
    options: [
      { value: "seoul", label: "서울", fact: "서울에 살아요" },
      { value: "metro", label: "경기·인천", fact: "경기·인천에 살아요" },
      { value: "other", label: "그 밖", fact: "수도권 밖에 살아요" },
    ],
  },
  {
    key: "ai_tool",
    ask: "일할 때 AI 도구 쓰세요?",
    about: "AI 소식",
    group: "IT/과학",
    trigger: /AI|인공지능|챗GPT|ChatGPT|제미나이|Gemini|클로드|Claude|오픈AI|OpenAI|LLM|생성형/,
    options: [
      { value: "daily", label: "매일", fact: "일할 때 AI 도구를 매일 써요" },
      { value: "sometimes", label: "가끔", fact: "일할 때 AI 도구를 가끔 써요" },
      { value: "no", label: "안 써요", fact: "일할 때 AI 도구는 안 써요" },
    ],
  },
  {
    key: "phone",
    ask: "휴대폰은요?",
    about: "스마트폰 소식",
    group: "IT/과학",
    trigger: /아이폰|iPhone|iOS|애플|갤럭시|Galaxy|안드로이드|스마트폰|휴대폰/,
    options: [
      { value: "iphone", label: "아이폰", fact: "아이폰을 써요" },
      { value: "galaxy", label: "갤럭시", fact: "갤럭시를 써요" },
      { value: "etc", label: "그 밖", fact: "" },
    ],
  },
  // 세계
  {
    key: "trade",
    ask: "일하는 곳이 수출입과 관계있어요?",
    about: "무역 소식",
    group: "세계",
    trigger: /관세|수출|수입|무역|통상|공급망|FTA/,
    options: [
      { value: "yes", label: "있어요", fact: "일하는 곳이 수출입과 관계있어요" },
      { value: "no", label: "없어요", fact: "일하는 곳은 수출입과 관계없어요" },
    ],
  },
  // 스포츠
  {
    key: "sport",
    ask: "주로 보는 종목은요?",
    about: "스포츠 소식",
    group: "스포츠",
    trigger: /야구|KBO|MLB|한국시리즈|포스트시즌|타이거즈|라이온즈|트윈스|베어스|위즈|랜더스|자이언츠|이글스|다이노스|히어로즈|축구|K리그|프리미어리그|EPL|챔피언스리그|농구|배구|KBL|V리그|골프|LPGA|PGA|월드컵|올림픽/,
    options: [
      { value: "baseball", label: "야구", fact: "야구를 주로 봐요" },
      { value: "soccer", label: "축구", fact: "축구를 주로 봐요" },
      { value: "ball", label: "농구·배구", fact: "농구·배구를 주로 봐요" },
      { value: "golf", label: "골프", fact: "골프를 주로 봐요" },
      { value: "none", label: "안 봐요", fact: "" },
    ],
  },
  {
    key: "kbo_team",
    ask: "응원하는 야구팀은요?",
    about: "야구 소식",
    group: "스포츠",
    trigger: /야구|KBO|타이거즈|라이온즈|트윈스|베어스|위즈|랜더스|자이언츠|이글스|다이노스|히어로즈|한국시리즈|포스트시즌/,
    after: { key: "sport", value: "baseball" },
    options: [
      { value: "kia", label: "KIA", fact: "야구는 KIA 타이거즈를 응원해요" },
      { value: "samsung", label: "삼성", fact: "야구는 삼성 라이온즈를 응원해요" },
      { value: "lg", label: "LG", fact: "야구는 LG 트윈스를 응원해요" },
      { value: "doosan", label: "두산", fact: "야구는 두산 베어스를 응원해요" },
      { value: "kt", label: "KT", fact: "야구는 KT 위즈를 응원해요" },
      { value: "ssg", label: "SSG", fact: "야구는 SSG 랜더스를 응원해요" },
      { value: "lotte", label: "롯데", fact: "야구는 롯데 자이언츠를 응원해요" },
      { value: "hanwha", label: "한화", fact: "야구는 한화 이글스를 응원해요" },
      { value: "nc", label: "NC", fact: "야구는 NC 다이노스를 응원해요" },
      { value: "kiwoom", label: "키움", fact: "야구는 키움 히어로즈를 응원해요" },
      { value: "none", label: "없어요", fact: "" },
    ],
  },
  {
    key: "exercise",
    ask: "직접 하는 운동 있으세요?",
    about: "운동 소식",
    group: "스포츠",
    trigger: /러닝|마라톤|골프|등산|헬스|피트니스|운동|체육관|자전거/,
    options: [
      { value: "run", label: "러닝", fact: "러닝을 해요" },
      { value: "golf", label: "골프", fact: "골프를 쳐요" },
      { value: "hike", label: "등산", fact: "등산을 해요" },
      { value: "gym", label: "헬스", fact: "헬스를 해요" },
      { value: "none", label: "없어요", fact: "" },
    ],
  },
  // 엔터
  {
    key: "enjoy",
    ask: "주로 즐기는 건요?",
    about: "엔터 소식",
    group: "엔터",
    trigger: /드라마|예능|영화|개봉|박스오피스|아이돌|K-팝|케이팝|컴백|앨범|웹툰|배우|가수|시청률/,
    options: [
      { value: "drama", label: "드라마·예능", fact: "드라마·예능을 즐겨 봐요" },
      { value: "movie", label: "영화", fact: "영화를 즐겨 봐요" },
      { value: "kpop", label: "K-팝", fact: "K-팝을 즐겨 들어요" },
      { value: "webtoon", label: "웹툰", fact: "웹툰을 즐겨 봐요" },
    ],
  },
  {
    key: "ott",
    ask: "가장 많이 쓰는 OTT는요?",
    about: "OTT 소식",
    group: "엔터",
    trigger: /넷플릭스|Netflix|티빙|쿠팡플레이|디즈니|웨이브|OTT|스트리밍|구독료/,
    options: [
      { value: "netflix", label: "넷플릭스", fact: "넷플릭스를 주로 써요" },
      { value: "tving", label: "티빙", fact: "티빙을 주로 써요" },
      { value: "coupang", label: "쿠팡플레이", fact: "쿠팡플레이를 주로 써요" },
      { value: "disney", label: "디즈니+", fact: "디즈니+를 주로 써요" },
      { value: "none", label: "안 써요", fact: "OTT는 안 써요" },
    ],
  },
  // 생활/문화
  {
    key: "pet",
    ask: "반려동물 있으세요?",
    about: "반려동물 소식",
    group: "생활/문화",
    trigger: /반려|강아지|반려견|고양이|반려묘|펫|동물병원|사료|유기견|유기묘/,
    options: [
      { value: "dog", label: "강아지", fact: "강아지를 키워요" },
      { value: "cat", label: "고양이", fact: "고양이를 키워요" },
      { value: "none", label: "없어요", fact: "" },
    ],
  },
];

export const QUESTION_BY_KEY = new Map(CONTEXT_QUESTIONS.map((q) => [q.key, q]));

/** '나중에'(이 값이면 7일 동안 다시 묻지 않는다) */
export const SKIP = "skip";
export const SKIP_DAYS = 7;

export type UserContext = Record<string, { value: string; updatedAt: string }>;

/** 회원 사정 하나(질문 key·고른 값·칩 이름·인사이트에 주는 말) */
export interface ContextFact {
  key: string;
  value: string;
  label: string;
  fact: string;
  /** 분야를 통째로 고른 '관심'(온보딩 카드 한 번 누름)이라 무엇에 관심 있는지 알려 주지 않는다 */
  whole?: boolean;
}

/** 인사이트에 줄 회원 사정(나중에·모름·기타는 뺀다). 질문 목록 차례(요즘 신경 쓰는 경제 부문이 맨 앞) */
export function contextFactItems(ctx: UserContext): ContextFact[] {
  const out: ContextFact[] = [];
  for (const q of CONTEXT_QUESTIONS) {
    const v = ctx[q.key]?.value;
    if (!v || v === SKIP) continue;
    if (q.after && ctx[q.after.key]?.value !== q.after.value) continue;
    const values = valuesOf(q, v);
    // 온보딩 카드(분야를 통째로 고름)만. 선택지를 나중에 더해도(11-13 AI에 로봇) 예전에 카드를 누른 회원을 통째로 보게 80% 이상이면 통째로.
    // '요즘 신경 쓰는 경제 부문'은 많이 골라도 하나하나가 사정이다(개수 제한 없음, 2026-11-13)
    const whole = !!q.multi && !!q.section && q.options.length > 2 && values.length >= Math.ceil(q.options.length * 0.8);
    for (const value of values) {
      const o = q.options.find((x) => x.value === value);
      if (o?.fact) out.push({ key: q.key, value, label: o.label, fact: o.fact, ...(whole ? { whole } : {}) });
    }
  }
  return out;
}

/** 인사이트에 줄 회원 사정 문장들(나중에·모름·기타는 뺀다) */
export function contextFacts(ctx: UserContext): string[] {
  return contextFactItems(ctx).map((f) => f.fact);
}

/** 저장된 값을 고른 값들로(여러 개를 고르는 질문은 쉼표로 이어 저장한다) */
export function valuesOf(q: Pick<ContextQuestion, "multi">, value: string | undefined): string[] {
  if (!value || value === SKIP) return [];
  return q.multi ? value.split(",").filter(Boolean) : [value];
}

/** 맞춤 체크 꼬리표에 쓰는 짧은 이름(예: '주식 · 국내') */
export function contextChip(ctx: UserContext, key: string): string | null {
  const q = QUESTION_BY_KEY.get(key);
  const v = ctx[key]?.value;
  if (!q || !v || v === SKIP) return null;
  const labels = valuesOf(q, v).flatMap((x) => q.options.find((o) => o.value === x)?.label ?? []);
  return labels.length ? labels.join("·") : null;
}

/** 오늘 이미 새 질문에 답했는지 남기는 줄(값: 한국 날짜 YYYY-MM-DD). 새 질문은 하루에 하나 */
export const ASKED = "_asked";

export interface PickedQuestion {
  key: string;
  ask: string;
  about: string;
  options: { value: string; label: string }[];
}

/**
 * 이 소식(들)과 관계있고 아직 모르는 질문 하나(없으면 null). day는 한국 날짜(새 질문은 하루에 하나, 이어 묻는 질문은 바로).
 * 2026-11-11 사용자: 대놓고 묻지 말고 기사를 다 읽었을 때·다른 화면으로 넘어갈 때 귀찮지 않을 만큼만(components/context/ContextAsk.tsx)
 */
export function pickQuestion(ctx: UserContext, items: ContextItem[], day: string): PickedQuestion | null {
  const text = items.map((i) => `${i.title} ${i.short}`).join("\n");
  const askedNow = ctx[ASKED]?.value === day;
  const skipUntil = Date.now() - SKIP_DAYS * 86_400_000;
  for (const q of CONTEXT_QUESTIONS) {
    // 온보딩에서만 묻는 질문은 기사 아래에서 묻지 않는다
    if (q.onboarding) continue;
    const have = ctx[q.key];
    if (have && (have.value !== SKIP || Date.parse(have.updatedAt) > skipUntil)) continue;
    if (q.after && ctx[q.after.key]?.value !== q.after.value) continue;
    // 새 질문은 하루에 하나. 이어 묻는 질문은 바로
    if (!q.after && askedNow) continue;
    if (!q.trigger.test(text)) continue;
    return { key: q.key, ask: q.ask, about: q.about, options: q.options.map((o) => ({ value: o.value, label: o.label })) };
  }
  return null;
}

/** 이 답 뒤에 바로 이어 묻는 질문(주식 해요 → 국내·미국, 무주택 → 청약). 없으면 null */
export function followUpOf(key: string, value: string): PickedQuestion | null {
  const q = CONTEXT_QUESTIONS.find((c) => c.after?.key === key && c.after.value === value);
  return q ? { key: q.key, ask: q.ask, about: q.about, options: q.options.map((o) => ({ value: o.value, label: o.label })) } : null;
}

/** '맞춤 인사이트' 끔(설정, 개인정보 처리방침 5조의 국외 이전 거부 방법). 값 '1'이면 끔: 질문하지 않고, 오늘의 흐름에 회원 정보를 보내지 않는다 */
export const PERSONAL_OFF = "_personal_off";

export function personalOn(ctx: UserContext): boolean {
  return ctx[PERSONAL_OFF]?.value !== "1";
}

/** 맞춤 체크·주간 리포트에서 걸러 낼 투자 권유 말(사라·팔라·비중 조절 등) */
export const INVESTING_ADVICE = /포트폴리오|비중|매수|매도|분산 투자|사 보세요|팔아|투자해|종목을|사고팔|리밸런싱|손절|익절|투자를 점검|쏠린 투자|쏠림을 줄|대비해 보세요|대비하세요/;
