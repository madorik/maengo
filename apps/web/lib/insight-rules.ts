// 맞춤 인사이트(오늘의 흐름·맞춤 체크)의 근거 번호·꼬리표·거르기 규칙(2026-11-13 품질 검토, 맹고-문서/오늘의-흐름.md).
// 서버 없이 시험할 수 있게 lib/server/briefing-insight.ts에서 뺐다(lib/__tests__/insight-rules.test.ts).
//
// 검토에서 본 문제와 여기서 막는 것:
// - 꼬리표를 AI가 지어냈다('관심 있는 반도체'라고 답한 적 없는 회원, 읽은 게 0개인데 '자주 보는 정치') → 근거에 번호를 주고 꼬리표는 서버가 붙인다
// - 때를 짐작했다(오늘 들은 소식을 '지난주 들은') → 최근 소식에 때를 붙여 주고, 근거에 없는 '지난주'는 지운다
// - 27개 중 25개가 '지켜보세요'로 끝났다 → 맞춤 체크 끝의 막연한 관찰 권유 문장을 잘라 내고, 그것뿐이면 버린다
// - 분야만 아는 회원에게 문화·정치 소식을 돈에 억지로 이었다(미술관 관람객 → 소비, 감찰 → 종부세) → 분야만 근거면 돈 쪽 소식만
// - 정치 소식을 증시 심리로 이었다('정국 혼란이 투자 심리를 위축') → 요약에 증시 얘기가 없는 정치 소식은 증시로 잇지 않는다
import type { ContextFact } from "@maengo/core/context";

export type BasisKind = "recent" | "fact" | "section" | "keyword";

/** 맞춤 체크·흐름을 회원과 잇는 근거 하나. id는 AI에게 주는 번호(F1·R2·S1·K1) */
export interface Basis {
  id: string;
  kind: BasisKind;
  /** 꼬리표(서버가 붙인다). recent는 AI가 준 대상 이름을 붙여 완성한다 */
  label: string;
  /** AI에게 주는 한 줄 */
  line: string;
  /** recent: 때('오늘 아침'·'어제'·'3일 전')와 한 일('들은'·'읽은'·'북마크한'), 며칠 전인지, 소식 번호 */
  when?: string;
  verb?: string;
  days?: number;
  clusterId?: number;
}

/** 분야만 근거일 때 맞춤 체크를 고를 수 있는 소식 종류(돈으로 닿는 길이 있는 것) */
export const MONEY_CATEGORIES: ReadonlySet<string> = new Set(["finance", "realestate", "crypto", "business"]);

/** 최근 7일 읽거나 들은 소식이 이만큼은 돼야 '자주 보는'이라고 부른다(아니면 '고른 ○○ 분야') */
export const SEEN_MIN = 3;

/** 이어지는 이야기로 보는 묶음 중심 벡터 코사인(2026-11-13 실제로 이어진 쌍 0.72~0.83, 상관없는 쌍 0.52~0.68) */
export const LINK_COSINE = 0.72;

/** 돈 쪽 사정(맞춤 체크에서 일 다음으로 먼저 쓴다) */
const MONEY_KEYS = new Set(["stock", "stock_market", "crypto", "loan", "savings", "overseas_pay", "home", "apply", "housing", "buy_plan", "region"]);
const WORK_KEYS = new Set(["job", "dev_area", "trade", "work_type"]);
/** 닿는 길이 없는 답(안 해요·없어요): 근거로는 쓰지 않고 참고로만 준다 */
const NEGATIVE = new Set(["no", "none", "rarely"]);

/** 칩 이름만으로는 뜻이 안 서는 답의 꼬리표('해요' → '주식') */
const SHORT: Record<string, string> = {
  "stock:yes": "주식",
  "stock_market:kr": "국내 주식",
  "stock_market:us": "미국 주식",
  "stock_market:both": "국내·미국 주식",
  "crypto:yes": "코인",
  "loan:variable": "변동금리 대출",
  "loan:fixed": "고정금리 대출",
  "savings:deposit": "예적금",
  "savings:invest": "투자해 둔 돈",
  "savings:both": "예적금·투자",
  "overseas_pay:often": "잦은 해외 결제",
  "overseas_pay:sometimes": "해외 결제",
  "home:one": "1주택",
  "home:multi": "다주택",
  "apply:yes": "청약 준비",
  "housing:own": "자가",
  "housing:jeonse": "전세",
  "housing:monthly": "월세",
  "buy_plan:yes": "집 살 계획",
  "region:seoul": "서울",
  "region:metro": "경기·인천",
  "region:other": "수도권 밖",
  "trade:yes": "수출입 일",
  "commute:car": "자가용 출퇴근",
  "commute:transit": "대중교통 출퇴근",
  "car:fuel": "휘발유·경유 차",
  "car:ev": "전기·하이브리드 차",
  "ai_tool:daily": "매일 쓰는 AI 도구",
  "ai_tool:sometimes": "일에 쓰는 AI 도구",
  "work_type:employee": "회사 일",
  "work_type:self": "자영업",
  "work_type:freelance": "프리랜서 일",
};

/** 사정 하나의 꼬리표 */
export function factLabel(f: ContextFact): string {
  if (f.key === "focus") return `신경 쓰는 ${f.label}`;
  if (f.key.startsWith("int_")) return `관심 있는 ${f.label}`;
  const short = SHORT[`${f.key}:${f.value}`];
  if (short) return short;
  if (f.key === "job") return `${f.label} 일`;
  if (f.key === "kids") return `${f.label} 자녀`;
  if (f.key === "kbo_team") return `${f.label} 응원`;
  return f.label;
}

/**
 * 사정을 근거(F1…)와 참고로 나눈다. 차례: 신경 쓰는 경제 부문 → 일 → 돈 사정 → 고른 관심 → 생활.
 * 분야를 통째로 고른 관심(온보딩 카드 한 번)은 무엇에 관심 있는지 알려 주지 않아 뺀다(분야 근거 S로 이미 들어간다)
 */
export function factBases(facts: ContextFact[]): { bases: Basis[]; notes: string[] } {
  const rank = (f: ContextFact) => (f.key === "focus" ? 0 : WORK_KEYS.has(f.key) ? 1 : MONEY_KEYS.has(f.key) ? 2 : f.key.startsWith("int_") ? 3 : 4);
  const usable = facts.filter((f) => !f.whole && !NEGATIVE.has(f.value)).sort((a, b) => rank(a) - rank(b));
  const notes = facts.filter((f) => !f.whole && NEGATIVE.has(f.value)).map((f) => f.fact);
  return { bases: usable.map((f, i) => ({ id: `F${i + 1}`, kind: "fact", label: factLabel(f), line: f.fact })), notes };
}

/** 최근 본 소식 하나 */
export interface RecentRead {
  clusterId: number;
  title: string;
  /** 듣거나 읽은 때(ISO). 둘 다 있으면 늦은 쪽 */
  at: string;
  listened: boolean;
  read: boolean;
  starred: boolean;
}

/** 브리핑 날짜(한국 날짜 YYYY-MM-DD)에서 본 때: '오늘 아침'·'오늘'·'어제'·'그제'·'n일 전' */
export function whenOf(atIso: string, date: string): { when: string; days: number } {
  const kst = new Date(Date.parse(atIso) + 9 * 3600_000);
  const day = kst.toISOString().slice(0, 10);
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return { when: kst.getUTCHours() < 12 ? "오늘 아침" : "오늘", days: 0 };
  if (days === 1) return { when: "어제", days };
  if (days === 2) return { when: "그제", days };
  return { when: `${days}일 전`, days };
}

/** 최근 본 소식을 근거(R1…)로. 꼬리표는 AI가 준 대상 이름으로 recentLabel이 완성한다 */
export function recentBases(reads: RecentRead[], date: string): Basis[] {
  return reads.map((r, i) => {
    const { when, days } = whenOf(r.at, date);
    const verb = r.starred ? "북마크한" : r.listened ? "들은" : "읽은";
    const how = [r.listened && "끝까지 들음", r.read && "열어 봄", r.starred && "북마크"].filter(Boolean).join("·");
    return { id: `R${i + 1}`, kind: "recent", label: `${when} ${verb} 소식`, line: `(${when}, ${how}) ${r.title}`, when, verb, days, clusterId: r.clusterId };
  });
}

/** 분야 근거(S1…): 최근 본 게 적으면 '자주 보는'이 아니라 '고른 ○○ 분야' */
export function sectionBases(sections: string[], seen: boolean): Basis[] {
  return sections.map((s, i) => {
    const label = seen ? `자주 보는 ${s}` : `고른 ${s} 분야`;
    return { id: `S${i + 1}`, kind: "section", label, line: label };
  });
}

/** 직접 넣은 키워드 근거(K1…) */
export function keywordBases(keywords: string[]): Basis[] {
  return keywords.map((k, i) => ({ id: `K${i + 1}`, kind: "keyword", label: `내 키워드 ${k}`, line: `직접 넣은 키워드: ${k}` }));
}

/** 꼬리표 완성: recent는 '오늘 아침 들은 엔비디아 소식'처럼 AI가 준 대상 이름(2~10자)을 넣는다 */
export function basisLabel(b: Basis, topic: string): string {
  if (b.kind !== "recent") return b.label;
  const t = topic.replace(/\s+/g, " ").trim().replace(/\s*소식$/, "").slice(0, 10);
  return t ? `${b.when} ${b.verb} ${t} 소식` : b.label;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** 오늘 소식과 이어지는 최근 소식(묶음 중심 벡터 코사인 LINK_COSINE 이상). 오늘 소식 번호 → 최근 근거 번호들 */
export function findLinks(today: { id: number; vec: number[] | null }[], recent: { basisId: string; vec: number[] | null }[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const t of today) {
    if (!t.vec) continue;
    const hits = recent
      .filter((r) => r.vec)
      .map((r) => ({ id: r.basisId, c: cosine(t.vec!, r.vec!) }))
      .filter((x) => x.c >= LINK_COSINE)
      .sort((a, b) => b.c - a.c)
      .map((x) => x.id);
    if (hits.length) out.set(t.id, hits.slice(0, 2));
  }
  return out;
}

/** 관찰만 권하는 막연한 끝맺음('흐름을 지켜보세요', '어떤 영향을 줄지 확인해 보세요') */
const VAGUE = new RegExp(
  [
    "지켜보세요",
    "지켜봐 보세요",
    "지켜봐야 해요",
    "지켜볼 만해요",
    "지켜보는 게 좋아요",
    "살펴보세요",
    "살펴봐야 해요",
    "살펴보는 것이 좋아요",
    "살피면 좋아요",
    "살필 필요가 있어요",
    "주시해 보세요",
    "주시하세요",
    "모니터링해 보세요",
    "눈여겨보세요",
    "눈여겨볼 만해요",
    "주목해 보세요",
    "주목하세요",
    "관심을 두고[^.]*",
    "(흐름|추이|동향|변동성|움직임|분위기)[을를]? ?(계속 |차분히 |꾸준히 |주의 깊게 )?확인해 보세요",
    "(어떤 영향|어떤 변화|어떤 변수|어떤 파장|어떻게 [^.]{0,20})[^.]{0,40}확인해 보세요",
    "확인할 필요가 있어요",
    "지켜볼 필요가 있어요",
    "중요해요",
  ].join("|") + "\\.?$",
);

/** 맞춤 체크 글 끝의 막연한 관찰 권유 문장을 잘라 낸다. 다 잘리면 빈 문자열(그 맞춤 체크는 버린다) */
export function trimVague(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  while (sentences.length && VAGUE.test(sentences[sentences.length - 1]!)) sentences.pop();
  return sentences.join(" ");
}

const MARKET = /증시|주가|코스피|코스닥|투자 심리|주식/;

/** 정치 소식을 증시로 잇는지(요약에 증시 얘기가 없는데) */
export function politicsToMarket(category: string | undefined, itemText: string, text: string): boolean {
  return category === "politics" && MARKET.test(text) && !MARKET.test(itemText);
}

/** 근거에 없는 때·분야 말 바로잡기: 읽은 게 적으면 '자주 보는' → '고른', 5일 넘은 최근 소식이 없으면 '지난주' 지우기 */
export function fixClaims(text: string, opts: { seen: boolean; oldest: number }): string {
  let t = text;
  if (!opts.seen) t = t.replace(/자주 보는/g, "고른");
  if (opts.oldest < 5) t = t.replace(/지난주(에|에도)?\s*/g, "");
  return t;
}

const READ_CLAIM = /(오늘 아침|오늘|어제|그제|지난주|지난번|최근|\d+일 전)(에)? ?(끝까지 )?(들은|읽은|본|북마크한|확인한|접한)/g;

/** 근거가 최근 소식이면 글 속 '○○ 들은/읽은'의 때와 한 일을 근거대로(검토: 오늘 들은 걸 '어제 들은', 읽기만 한 걸 '6일 전 들은') */
export function alignReadClaim(text: string, b: Basis | undefined): string {
  if (!b || b.kind !== "recent") return text;
  return text.replace(READ_CLAIM, `${b.when} ${b.verb}`);
}

/** 가졌다고 알려 준 사정(주식을 해요·대출이 있어요·집이 한 채 등) */
const HOLDING_FACT = /주식을 해요|주식\((국장|미장)\)을 해요|주식을 다 해요|코인을 해요|대출이 있어요|집이 (한|두) 채|자기 집에 살아요|예적금으로 모아요|투자로 모아요|반반 해요/;

/** 가졌다고 알려 주지 않았는데 '보유한'이라고 단정하는 말을 뺀다(검토: 키워드 '종부세'로 '보유한 부동산의 세 부담') */
export function dropOwnership(text: string, b: Basis): string {
  if (b.kind === "fact" && HOLDING_FACT.test(b.line)) return text;
  return text.replace(/(보유한|보유 중인|가지고 있는|갖고 있는) /g, "");
}

/** 맞춤 체크 차례: 이어지는 이야기 → 신경 쓰는 경제 부문·일·경제 사정 → 최근 소식 → 키워드 → 분야 */
export function basisRank(b: Basis, linked: boolean): number {
  if (b.kind === "recent") return linked ? 0 : 2;
  if (b.kind === "fact") return 1;
  if (b.kind === "keyword") return 3;
  return 4;
}

/** 화면 글에 '돈'을 쓰지 않는다(2026-11-13 사용자: '관심 있는 경제 부문'처럼 돌려 말한다). 지시해도 나오는 '돈 쪽'을 '경제 쪽'으로 */
export function plainWords(text: string): string {
  return text.replace(/돈 쪽/g, "경제 쪽");
}
