import { useSyncExternalStore } from "react";

// 오늘 플레이어 목록에서 뺀 소식. 오늘 전체 듣기는 이 소식을 빼고 이어 붙인다(뺀 소식은 음성도 만들지 않는다).
// 이 기기 브라우저 저장소(localStorage)에 그날 것만 둔다. 날이 바뀌면 쓰지 않는다. 저장소가 막혀 있으면 이번 화면에서만 기억한다.

export const REMOVED_KEY = "maengo:listen-removed";

const NONE: ReadonlySet<number> = new Set();

export function parseRemoved(raw: string | null, date: string): ReadonlySet<number> {
  if (!raw) return NONE;
  try {
    const r = JSON.parse(raw) as { date?: unknown; ids?: unknown } | null;
    if (!r || r.date !== date || !Array.isArray(r.ids)) return NONE;
    return new Set(r.ids.filter((n): n is number => Number.isInteger(n) && n > 0));
  } catch {
    return NONE;
  }
}

/** 오늘 소식 중 플레이어에 남은 것(화면 순서 그대로) */
export function keptIds(ids: number[], removed: ReadonlySet<number>): number[] {
  return removed.size ? ids.filter((id) => !removed.has(id)) : ids;
}

// 저장소가 막혀 있어도 이번 화면에서는 뺀 게 유지되게 마지막 값을 들고 있는다
let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(REMOVED_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function saveRemoved(date: string, ids: Iterable<number>) {
  memory = JSON.stringify({ date, ids: [...ids] });
  try {
    window.localStorage.setItem(REMOVED_KEY, memory);
  } catch {}
  for (const cb of listeners) cb();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

/** 저장된 값(문자열 그대로). 서버 렌더와 첫 화면에서는 null이라 화면이 어긋나지 않는다 */
export function useRemovedRaw(): string | null {
  return useSyncExternalStore(subscribe, readRaw, () => null);
}
