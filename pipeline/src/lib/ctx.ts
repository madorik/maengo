import type { GeminiAi } from '@maengo/core/gemini';

export interface Ctx {
  /** 피드 날짜(KST) */
  date: string;
  now: Date;
  ai: GeminiAi;
  log: (msg: string) => void;
  /** 단계별 건수. report가 pipeline_runs.stats로 남긴다 */
  stats: Record<string, Record<string, unknown>>;
  /** 이미 있는 오늘 피드도 다시 만든다 */
  force: boolean;
  /** 수집·묶기 창(시간) */
  windowHours: number;
}

export const HOUR = 3600_000;
