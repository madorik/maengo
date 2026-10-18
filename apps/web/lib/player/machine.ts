import type { Chapter } from '@maengo/core/types';

// "오늘 소식 이어 듣기" 플레이어의 판단 로직(PLAN.md 8.3). <audio> 하나에 에피소드 파일 하나를 틀고,
// 항목 이동은 전부 챕터 시각으로 seek 한다. DOM 없이 테스트할 수 있게 순수 함수만 둔다.

export interface PlayerPrefs {
  autoNext: boolean;
  skipRead: boolean;
}

/** ms가 속한 챕터 번호. 첫 챕터 앞이면 0, 마지막 챕터 뒤면 chapters.length */
export function chapterAt(chapters: Chapter[], ms: number): number {
  if (!chapters.length) return 0;
  for (let i = 0; i < chapters.length; i++) if (ms < chapters[i]!.endMs) return i;
  return chapters.length;
}

export function isSkipped(chapter: Chapter, read: ReadonlySet<number>, skipRead: boolean): boolean {
  return skipRead && read.has(chapter.clusterId);
}

/** from부터(포함) 앞으로 건너뛰지 않는 첫 챕터. 없으면 null */
export function nextPlayable(chapters: Chapter[], from: number, read: ReadonlySet<number>, skipRead: boolean): number | null {
  for (let i = Math.max(0, from); i < chapters.length; i++) if (!isSkipped(chapters[i]!, read, skipRead)) return i;
  return null;
}

/** from부터(포함) 뒤로 건너뛰지 않는 첫 챕터. 없으면 null */
export function prevPlayable(chapters: Chapter[], from: number, read: ReadonlySet<number>, skipRead: boolean): number | null {
  for (let i = Math.min(from, chapters.length - 1); i >= 0; i--) if (!isSkipped(chapters[i]!, read, skipRead)) return i;
  return null;
}

/** 이어 듣기 시작 위치. 다 읽어서 건너뛸 게 없으면 처음부터 */
export function startIndex(chapters: Chapter[], read: ReadonlySet<number>, skipRead: boolean): number {
  return nextPlayable(chapters, 0, read, skipRead) ?? 0;
}

export type Tick =
  | { kind: 'none' }
  /** 새 챕터에 들어섰다(들음 기록) */
  | { kind: 'enter'; index: number }
  /** 자동 재생이 꺼져 있어 다음 챕터 시작점에서 멈춘다 */
  | { kind: 'hold'; index: number; atMs: number }
  /** 읽은 챕터를 건너뛴다 */
  | { kind: 'skip'; index: number; toMs: number }
  | { kind: 'end' };

/** timeupdate마다 부른다. cur는 지금 듣고 있다고 알고 있는 챕터. */
export function tick(chapters: Chapter[], cur: number, ms: number, read: ReadonlySet<number>, prefs: PlayerPrefs): Tick {
  const at = chapterAt(chapters, ms);
  if (at >= chapters.length) return { kind: 'end' };
  if (at === cur) return { kind: 'none' };
  // 뒤로 갔거나 처음 시작했다면 그 챕터에 그대로 들어선다
  if (cur < 0 || at < cur) return { kind: 'enter', index: at };

  // 앞 챕터가 끝나 자연스럽게 넘어온 경우
  const target = nextPlayable(chapters, at, read, prefs.skipRead);
  if (target === null) return { kind: 'end' };
  if (!prefs.autoNext) return { kind: 'hold', index: target, atMs: chapters[target]!.startMs };
  if (target !== at) return { kind: 'skip', index: target, toMs: chapters[target]!.startMs };
  return { kind: 'enter', index: at };
}

/** 지금 줄 번호(대본 하이라이트용). 줄 사이 쉼에서는 직전 줄을 유지한다 */
export function lineAt(chapter: Chapter | undefined, ms: number): number {
  if (!chapter) return -1;
  let found = -1;
  chapter.lines.forEach((l, i) => {
    if (ms >= l.startMs) found = i;
  });
  return found;
}

export interface Progress {
  elapsedMs: number;
  totalMs: number;
  /** 건너뛰지 않는 항목 중 몇 번째인지(1부터). 시작 전이면 0 */
  position: number;
  count: number;
  /** 진행 막대 칸. 길이 비율대로 나눈다 */
  segments: { durationMs: number; fill: number; current: boolean; skipped: boolean }[];
}

export function progress(chapters: Chapter[], cur: number, ms: number, read: ReadonlySet<number>, skipRead: boolean): Progress {
  let elapsedMs = 0;
  let totalMs = 0;
  let count = 0;
  let position = 0;
  const segments = chapters.map((c, i) => {
    const skipped = isSkipped(c, read, skipRead);
    const durationMs = c.endMs - c.startMs;
    let fill = 0;
    if (!skipped) {
      count++;
      totalMs += durationMs;
      if (cur >= 0 && i < cur) fill = 1;
      if (i === cur) fill = Math.min(1, Math.max(0, (ms - c.startMs) / durationMs));
      elapsedMs += fill * durationMs;
      if (i === cur) position = count;
    }
    return { durationMs, fill, current: i === cur, skipped };
  });
  return { elapsedMs: Math.round(elapsedMs), totalMs, position, count, segments };
}

/**
 * 첫 소식을 그 소식 하나짜리 파일로 먼저 들을 때: 어림값 챕터 하나를 실제 대본 시각표(그 파일 기준, 0부터)로 바꿔 끼운다.
 * 시작 시각은 그대로 두고 끝·줄 시각만 실제 값으로 옮긴다(다른 챕터는 그대로)
 */
export function withRealChapter(chapters: Chapter[], index: number, real: Chapter): Chapter[] {
  const c = chapters[index];
  if (!c || c.clusterId !== real.clusterId) return chapters;
  const shift = c.startMs - real.startMs;
  const fixed: Chapter = {
    ...c,
    endMs: c.startMs + (real.endMs - real.startMs),
    lines: real.lines.map((l) => ({ ...l, startMs: l.startMs + shift, endMs: l.endMs + shift })),
  };
  return chapters.map((x, i) => (i === index ? fixed : x));
}

/**
 * 지금 소식(cur) 안에서 들은 자리(ms). 목록을 갈아 끼울 때 이 자리에서 이어 간다.
 * 옮겨 갈 자리를 기다리는 중이면(pending) 그 자리, 파일이 열려 있으면 실제 재생 위치(fileMs, 에피소드 시각),
 * 아니면(취소·오류로 파일을 떼어 냈거나 아직 안 열림: fileMs null) 화면의 자리(posMs)
 */
export function heldOffset(
  chapters: Chapter[],
  cur: number,
  { pending, fileMs, posMs }: { pending: { index: number; offsetMs?: number } | null; fileMs: number | null; posMs: number },
): number {
  const ch = chapters[cur];
  if (!ch) return 0;
  if (pending) return pending.index === cur ? Math.max(0, pending.offsetMs ?? 0) : 0;
  return Math.max(0, (fileMs ?? posMs) - ch.startMs);
}

/** 진행 막대 끝까지 끌어도 바로 끝나지 않게 마지막 항목 끝에서 이만큼 앞에 둔다 */
const END_GUARD_MS = 500;

/**
 * 진행 막대의 한 자리(건너뛰지 않는 항목만 이어 센 시각, progress의 elapsedMs와 같은 단위) → 그 챕터와 에피소드 시각.
 * 진행 막대를 끌어 옮길 때 쓴다. 들을 항목이 없으면 null
 */
export function positionAt(
  chapters: Chapter[],
  elapsedMs: number,
  read: ReadonlySet<number>,
  skipRead: boolean,
): { index: number; ms: number } | null {
  let acc = 0;
  let last = -1;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]!;
    if (isSkipped(c, read, skipRead)) continue;
    const d = c.endMs - c.startMs;
    if (elapsedMs < acc + d) return { index: i, ms: c.startMs + Math.max(0, elapsedMs - acc) };
    acc += d;
    last = i;
  }
  if (last < 0) return null;
  const c = chapters[last]!;
  return { index: last, ms: Math.max(c.startMs, c.endMs - END_GUARD_MS) };
}

/** 125000 → '2:05' */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
