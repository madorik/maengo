import type { Chapter } from "@maengo/core/types";
import { useSyncExternalStore } from "react";
import { nextPlayable } from "./machine";

// 듣던 자리 이어 듣기. 오늘 소식을 듣다 앱을 닫거나 새로 고쳐도(같은 날) 재생을 누르면 듣던 소식의 듣던 자리부터 튼다.
// 이 기기 브라우저 저장소(localStorage)에만 둔다. 저장소가 막혀 있으면(사생활 보호 모드 등) 이어 듣기 없이 늘 하던 대로 튼다.

export const RESUME_KEY = "maengo:listen-resume";

export interface Resume {
  /** 오늘 에피소드 날짜(KST). 날이 바뀌면 쓰지 않는다 */
  date: string;
  mode: "today";
  clusterId: number;
  /** 그 소식 안에서 들은 자리(ms) */
  offsetMs: number;
}

/** 끝에서 이만큼 안쪽까지 들었으면 그 소식은 다 들은 걸로 보고 다음 소식부터 */
const NEAR_END_MS = 2000;

export function parseResume(raw: string | null, date: string): Resume | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<Resume> | null;
    if (!r || r.mode !== "today" || r.date !== date) return null;
    if (!Number.isInteger(r.clusterId) || typeof r.offsetMs !== "number" || !Number.isFinite(r.offsetMs)) return null;
    return { date, mode: "today", clusterId: r.clusterId!, offsetMs: Math.max(0, Math.round(r.offsetMs)) };
  } catch {
    return null;
  }
}

/**
 * 이어 들을 항목과 그 안의 자리. 그 소식이 지금 목록에 없으면 null(처음 자리부터).
 * 듣던 소식은 읽었어도 건너뛰지 않는다(듣던 중이었으니). 거의 다 들었으면 다음 들을 소식 처음부터
 */
export function resumeTarget(
  chapters: Chapter[],
  r: Resume | null,
  read: ReadonlySet<number>,
  skipRead: boolean,
): { index: number; offsetMs: number } | null {
  if (!r) return null;
  const index = chapters.findIndex((c) => c.clusterId === r.clusterId);
  if (index < 0) return null;
  const ch = chapters[index]!;
  if (r.offsetMs < ch.endMs - ch.startMs - NEAR_END_MS) return { index, offsetMs: r.offsetMs };
  const next = nextPlayable(chapters, index + 1, read, skipRead);
  return next === null ? null : { index: next, offsetMs: 0 };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RESUME_KEY);
  } catch {
    return null;
  }
}

export function saveResume(r: Resume) {
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(r));
  } catch {}
}

export function clearResume() {
  try {
    window.localStorage.removeItem(RESUME_KEY);
  } catch {}
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/** 저장된 이어 듣기 값(문자열 그대로). 서버 렌더와 첫 화면에서는 null이라 화면이 어긋나지 않는다 */
export function useResumeRaw(): string | null {
  return useSyncExternalStore(subscribe, readRaw, () => null);
}
