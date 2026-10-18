// 되돌리기 알림(components/ui/Toast.tsx)으로 뺀 항목을 원래 자리에 돌려놓는 계산. 화면과 플레이어가 같이 쓴다.

/**
 * 뺀 항목(id)을 지금 목록(now)의 뺄 때 자리로 다시 끼운다. before는 빼기 직전 목록.
 * 그사이 다른 항목이 빠지거나 더해져도 앞에 있던 항목 바로 뒤(앞에 남은 게 없으면 뒤에 있던 항목 바로 앞)에 둔다.
 * 이미 있으면 그대로 돌려준다(겹치지 않게). before에 없던 항목이거나 기준이 될 항목이 하나도 안 남았으면 null
 */
export function reinsert(now: readonly number[], id: number, before: readonly number[]): number[] | null {
  if (now.includes(id)) return [...now];
  const at = before.indexOf(id);
  if (at < 0) return null;
  for (let i = at - 1; i >= 0; i--) {
    const j = now.indexOf(before[i]!);
    if (j >= 0) return [...now.slice(0, j + 1), id, ...now.slice(j + 1)];
  }
  for (let i = at + 1; i < before.length; i++) {
    const j = now.indexOf(before[i]!);
    if (j >= 0) return [...now.slice(0, j), id, ...now.slice(j)];
  }
  return now.length ? null : [id];
}
