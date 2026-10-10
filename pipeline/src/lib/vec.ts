/** 둘 다 정규화된 벡터라고 보고 내적만 한다 */
export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export function add(into: number[], v: number[]) {
  for (let i = 0; i < v.length; i++) into[i] = (into[i] ?? 0) + v[i]!;
}
