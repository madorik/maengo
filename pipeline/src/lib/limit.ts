/** 묶음(key)마다 하나씩 돌아가며 꺼낸 순서. 각 묶음 안의 순서는 그대로 둔다(상한으로 자를 때 한 묶음이 다 차지하지 않게) */
export function interleaveBy<T>(items: T[], key: (item: T) => unknown): T[] {
  const groups = new Map<unknown, T[]>();
  for (const it of items) {
    const k = key(it);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const g of groups.values()) if (round < g.length) out.push(g[round]!);
  }
  return out;
}

/** 동시에 n개까지만 돌리고, 결과는 입력 순서대로 돌려준다 */
export async function mapLimit<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
