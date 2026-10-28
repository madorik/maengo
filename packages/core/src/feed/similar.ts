// 하루 소식 안에 같은 사건을 다룬 소식이 여럿 나가지 않게 한다(2026-10-28). 같은 사건도 각도가 다른 기사는 묶음 기준(코사인 0.82,
// pipeline jobs/cluster.ts)에 조금 못 미쳐 따로 묶여서, 10-27 코스피 급등이 소식 3개로, 앤트로픽 상장이 3개로 나갔다.
// 10-22~28 피드 51개의 묶음 중심 벡터를 보니 코사인 0.75 이상은 거의 같은 사건이고 0.70~0.75는 섞여 있었다
// (같은 날 코스피 급등끼리 0.72~0.73은 같은 사건, '비트코인 8만 달러 하회 ↔ 유가 급등 뉴욕증시 하락' 0.74는 다른 소식).
// 그래서 0.75부터 같은 사건으로 보고, 같은 관심사에 하루 안에 나온 소식끼리는 0.70부터 본다.

/** 이 코사인부터 같은 사건으로 본다 */
export const SIMILAR_COSINE = 0.75;
/** 같은 관심사에 SAME_DAY_HOURS 안에 나온 소식끼리는 이 코사인부터 */
export const SIMILAR_COSINE_SAME_TOPIC = 0.7;
const SAME_DAY_HOURS = 24;

/** 같은 사건인지 견줄 소식 */
export interface SimilarityKey {
  /** 묶음 중심 벡터. 없으면 견주지 않는다(다른 소식으로 본다) */
  centroid?: number[] | null;
  /** 이 사람에게 고른 대표 관심사 */
  topicId: string;
  ageHours: number;
}

export function cosine(a: number[], b: number[]): number {
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

/** 둘이 같은 사건을 다룬 소식인지 */
export function sameStory(a: SimilarityKey, b: SimilarityKey): boolean {
  if (!a.centroid || !b.centroid) return false;
  const near = a.topicId === b.topicId && Math.abs(a.ageHours - b.ageHours) <= SAME_DAY_HOURS;
  return cosine(a.centroid, b.centroid) >= (near ? SIMILAR_COSINE_SAME_TOPIC : SIMILAR_COSINE);
}
