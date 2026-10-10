import type { Topic } from '../types';

/**
 * 문장 → 토픽 사전 id(PLAN.md 5.3). 키가 없을 때 쓰는 이름·별칭 맞추기.
 * 실제로는 AI가 같은 사전에서 고르고(structured output), 이건 그 전 단계의 대체품이다.
 * - 문장 안에 토픽 이름이나 별칭이 그대로 있으면 2점(긴 구절일수록 조금 더)
 * - 문장의 낱말(3글자 이상)이 이름·별칭 안에 있으면 1점(예: '쿠버네티스랑' → '쿠버네티스')
 */
export function matchTopics(text: string, dictionary: readonly Topic[], max = 3): string[] {
  const t = text.toLowerCase();
  const words = t.split(/[\s,·/]+|(?:이랑|랑|하고|그리고|및)(?=\s|$)/).map((w) => w.trim()).filter((w) => w.length >= 3);
  const scored = dictionary
    .map((topic) => {
      const names = [topic.name, ...topic.aliases].map((n) => n.toLowerCase());
      let score = 0;
      for (const n of names) {
        // 긴 구절이 맞을수록 조금 더 쳐준다('프론트엔드 성능' > '프론트엔드')
        if (t.includes(n)) score += 2 + n.length / 20;
        else if (words.some((w) => n.includes(w) || w.includes(n))) score += 1;
      }
      return { id: topic.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  // 큰 분류와 그 상세 관심사가 같이 맞으면 점수가 높은 쪽만 남긴다.
  // '프론트엔드 성능' → 웹 성능(상세가 더 정확), '부동산' → 부동산(상세는 이름에 낱말만 걸림)
  const score = new Map(scored.map((s) => [s.id, s.score]));
  const parentOf = new Map(dictionary.filter((t) => t.parent).map((t) => [t.id, t.parent!]));
  const drop = new Set<string>();
  for (const s of scored) {
    const parent = parentOf.get(s.id);
    if (!parent || !score.has(parent)) continue;
    drop.add(s.score >= score.get(parent)! ? parent : s.id);
  }
  return scored.filter((s) => !drop.has(s.id)).slice(0, max).map((s) => s.id);
}
