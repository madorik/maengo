/**
 * 오늘 화면 '오늘의 흐름' 카드에 쓰는 글 고르기(2026-11-26 시안 C안: 사진 위 흐름 제목 → 핵심 요약 두 줄 → '국내 주식에 부담 요인' + 영향 한 문장).
 * 화면(components/today/BriefingInsight.tsx)과 떼어 두어 시험한다(lib/__tests__/insight-card.test.ts)
 */

type Tone = "plus" | "minus" | "watch";

/** 분야 꼬리표('고른 경제 분야'·'자주 보는 경제')인지. 회원이 고른 사정·내 키워드보다 뒤로 미룬다 */
function isSectionLabel(label: string): boolean {
  return /^고른 .+ 분야$/.test(label) || /^자주 보는 /.test(label);
}

/**
 * 꼬리표를 카드의 '○○에 부담 요인' 자리에 맞게 줄인다: 앞말(신경 쓰는·관심 있는·내 키워드)은 떼고, 분야는 '경제 분야'처럼.
 * 예: '신경 쓰는 국내 주식' → '국내 주식', '고른 IT/과학 분야' → 'IT/과학 분야', '자주 보는 경제' → '경제 분야', 'IT·개발 일' → 그대로
 */
export function shortLabel(label: string): string {
  return label
    .trim()
    .replace(/^(신경 쓰는|관심 있는|내 키워드) /, "")
    .replace(/^고른 (.+) 분야$/, "$1 분야")
    .replace(/^자주 보는 (.+)$/, "$1 분야");
}

/** 카드가 짚을 관심 하나: 흐름이 닿는 관심(links) 가운데 회원이 고른 사정·내 키워드를 분야보다 먼저. 없으면 빈 문자열(성격만 보인다) */
export function whoOf(links: string[] | undefined): string {
  const list = links ?? [];
  const pick = list.find((l) => !isSectionLabel(l)) ?? list[0];
  return pick ? shortLabel(pick) : "";
}

/**
 * 핵심 요약 두 줄. 형식 14부터는 모델이 준 points, 그 전에 만든 인사이트는 핵심 사실(fact) + 흐름 설명의 첫 문장으로 채운다
 * (형식을 바꿔도 그날 이미 만든 인사이트는 다시 만들지 않아서, 다음 브리핑 전까지는 예전 형식이 보인다)
 */
export function pointsOf(flow: { points?: string[]; fact?: string; text: string }): string[] {
  if (flow.points?.length) return flow.points.slice(0, 2);
  const sentences = flow.text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  return [flow.fact, ...sentences].filter((s): s is string => !!s).slice(0, 2);
}

/**
 * 같은 흐름이 닿는 두 번째 관심(맞춤 체크에서): 카드에 '대출 이자에는 지켜볼 변수예요' 한 줄로.
 * 흐름의 소식으로 만든 맞춤 체크 가운데 첫 관심과 다른 것 하나. 없으면 null
 */
export function alsoOf(
  flow: { ids: number[] },
  who: string,
  personal: { id: number; about: string; tone?: Tone }[] | undefined,
): { who: string; tone: Tone } | null {
  for (const x of personal ?? []) {
    if (!x.tone || !flow.ids.includes(x.id)) continue;
    const name = shortLabel(x.about);
    if (name && name !== who) return { who: name, tone: x.tone };
  }
  return null;
}
