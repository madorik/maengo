import type { GeminiAi } from '@maengo/core/gemini';
import type { Topic } from '@maengo/core/types';

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
  /** 이번 실행의 토픽 사전(사전 + 누군가 고른 직접 입력 관심사). dictionary()로 읽는다 */
  topics?: Topic[];
  /** 이번 실행의 예산(서버 스케줄러가 작업마다 준다). 없으면 환경 변수 기본값·제한 없음 */
  budget?: {
    /** 한 번에 요약할 묶음 수 */
    summarizeLimit?: number;
    /** 한 번에 요약할 영상 수 */
    videoLimit?: number;
    /** 한 번에 임베딩할 글 수(최신 글부터) */
    embedLimit?: number;
    /** 이 시각(ms)이 지나면 새 요약을 시작하지 않는다(서버 함수 시간 제한) */
    deadline?: number;
  };
}

export const HOUR = 3600_000;
