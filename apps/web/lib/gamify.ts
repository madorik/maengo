// 오늘 읽고 들은 만큼 쌓이는 XP. 서버와 클라이언트가 같이 쓰는 순수 함수.

export const XP_PER_ITEM = 10;
export const XP_PER_FEEDBACK = 5;

export function xpToday(itemIds: number[], consumed: (id: number) => boolean, feedback: Readonly<Record<number, unknown>>): number {
  return itemIds.reduce((xp, id) => xp + (consumed(id) ? XP_PER_ITEM : 0) + (feedback[id] ? XP_PER_FEEDBACK : 0), 0);
}
