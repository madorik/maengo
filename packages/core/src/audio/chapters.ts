import type { Chapter, TimedLine } from '../types';

export interface SegmentLayout {
  rank: number;
  clusterId: number;
  title: string;
  durationMs: number;
  /** 세그먼트 안에서의 시각 */
  lines: TimedLine[];
}

/** 세그먼트를 순서대로 이어 붙였을 때의 챕터 표. 웹 플레이어와 MP3 ID3 챕터가 같은 값을 쓴다. */
export function layoutChapters(segments: SegmentLayout[], leadMs = 0): Chapter[] {
  let at = leadMs;
  return segments.map((s) => {
    const chapter: Chapter = {
      rank: s.rank,
      clusterId: s.clusterId,
      title: s.title,
      startMs: at,
      endMs: at + s.durationMs,
      lines: s.lines.map((l) => ({ ...l, startMs: at + l.startMs, endMs: at + l.endMs })),
    };
    at += s.durationMs;
    return chapter;
  });
}
