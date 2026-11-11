// 내 맞춤 정보(2026-11-11 사용자): 받은 소식과 관계있는 질문을 가끔 하나씩 딸깍으로 묻고(주식 소식 → '주식 하세요?' → '국내·미국?'),
// 모은 답으로 그 소식이 이 사람에게 무슨 뜻인지 짚는다(lib/server/briefing-insight.ts 맞춤 체크). 저장은 user_context(lib/server/user-context.ts).
// 서버·화면 공용(서버 전용 모듈을 import하지 않는다)
import type { FeedItem } from "./types";

export interface ContextOption {
  value: string;
  label: string;
  /** 인사이트에 주는 말(예: '국내 주식을 해요') */
  fact: string;
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
}

export const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    key: "stock",
    ask: "주식 하세요?",
    about: "주식 소식",
    trigger: /주식|코스피|코스닥|증시|주가|나스닥|S&P|다우|공모주|ETF|반도체주|상장/,
    options: [
      { value: "yes", label: "해요", fact: "주식을 해요" },
      { value: "no", label: "안 해요", fact: "주식은 안 해요" },
    ],
  },
  {
    key: "stock_market",
    ask: "주로 어디 주식이에요?",
    about: "주식 소식",
    trigger: /주식|코스피|코스닥|증시|주가|나스닥|S&P|다우|공모주|ETF|반도체주|상장/,
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
    trigger: /금리|대출|기준금리|한국은행|한은|연준|FOMC|주담대|DSR|가계부채/,
    options: [
      { value: "variable", label: "변동금리", fact: "변동금리 대출이 있어요" },
      { value: "fixed", label: "고정금리", fact: "고정금리 대출이 있어요" },
      { value: "none", label: "없어요", fact: "대출이 없어요" },
    ],
  },
  {
    key: "home",
    ask: "집은 어떤 상황이에요?",
    about: "부동산 소식",
    trigger: /부동산|아파트|집값|전세|월세|청약|재건축|재개발|분양|주택|임대차/,
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
    trigger: /부동산|아파트|집값|전세|월세|청약|재건축|재개발|분양|주택|임대차/,
    after: { key: "home", value: "none" },
    options: [
      { value: "yes", label: "준비 중", fact: "청약을 준비하고 있어요" },
      { value: "no", label: "아니요", fact: "청약은 준비하지 않아요" },
    ],
  },
  {
    key: "job",
    ask: "어떤 일을 하세요?",
    about: "일자리 소식",
    trigger: /AI|인공지능|채용|구조조정|일자리|노동|임금|파업|고용|자동화|정년/,
    options: [
      { value: "it", label: "IT·개발", fact: "IT·개발 일을 해요" },
      { value: "finance", label: "금융", fact: "금융 일을 해요" },
      { value: "maker", label: "제조", fact: "제조업에서 일해요" },
      { value: "public", label: "공공·교육", fact: "공공·교육 분야에서 일해요" },
      { value: "service", label: "서비스·유통", fact: "서비스·유통 일을 해요" },
      { value: "etc", label: "기타", fact: "" },
    ],
  },
];

export const QUESTION_BY_KEY = new Map(CONTEXT_QUESTIONS.map((q) => [q.key, q]));

/** '나중에'(이 값이면 7일 동안 다시 묻지 않는다) */
export const SKIP = "skip";
export const SKIP_DAYS = 7;

export type UserContext = Record<string, { value: string; updatedAt: string }>;

/** 인사이트에 줄 회원 사정 문장들(나중에·모름·기타는 뺀다) */
export function contextFacts(ctx: UserContext): string[] {
  const facts: string[] = [];
  for (const q of CONTEXT_QUESTIONS) {
    const v = ctx[q.key]?.value;
    if (!v || v === SKIP) continue;
    if (q.after && ctx[q.after.key]?.value !== q.after.value) continue;
    const fact = q.options.find((o) => o.value === v)?.fact;
    if (fact) facts.push(fact);
  }
  return facts;
}

/** 맞춤 체크 꼬리표에 쓰는 짧은 이름(예: '주식 · 국내') */
export function contextChip(ctx: UserContext, key: string): string | null {
  const q = QUESTION_BY_KEY.get(key);
  const v = ctx[key]?.value;
  if (!q || !v || v === SKIP) return null;
  return q.options.find((o) => o.value === v)?.label ?? null;
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
export function pickQuestion(ctx: UserContext, items: FeedItem[], day: string): PickedQuestion | null {
  const text = items.map((i) => `${i.title} ${i.short}`).join("\n");
  const askedNow = ctx[ASKED]?.value === day;
  const skipUntil = Date.now() - SKIP_DAYS * 86_400_000;
  for (const q of CONTEXT_QUESTIONS) {
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
