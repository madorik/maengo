// 내 관심 링크 유튜브 채널 영상을 고르는 규칙(DB 없이 시험할 수 있게 jobs/link-videos.ts에서 뗐다). 정책은 ROADMAP 10번

import { LINK_VIDEO_WINDOW_HOURS } from '@maengo/core/topics';

export const LINK_VIDEO = {
  minSeconds: 60,
  maxSeconds: 60 * 60,
  perUserSeconds: 90 * 60,
  /** 최근 1주일 안 영상만(2026-11-08 48시간 → 1주일, 사용자 결정). 그 사람이 아직 안 받은 것(요약 안 된 것)만 */
  maxAgeHours: LINK_VIDEO_WINDOW_HOURS,
  /** Premium 한 명당 하루 영상 요약 상한(원) */
  krwPerPremium: 52,
  usdKrw: 1400,
} as const;

/**
 * 영상 한 편 예상 비용(달러). 2026-11-08 실측(gemini-3.1-flash-lite, 저해상도, fps 0.1): 20분 영상이 영상 토큰 37,976개(1초 약 32개),
 * 입력 $0.25/100만. 프롬프트·토픽 사전 약 4천 토큰, 출력 약 1,500토큰($1.5/100만)을 더한다
 */
export function estimateVideoUsd(seconds: number): number {
  return ((seconds * 32 + 4000) * 0.25 + 1500 * 1.5) / 1e6;
}

export interface VideoPick {
  clusterId: number;
  seconds: number;
  publishedAt: number;
}

/**
 * 사람마다 하루 합계 perUserSeconds 안에서 채널 영상을 받는다. 오래 기다린 영상(발행이 이른 것)부터 넣어서 어제 밀린 채널이 먼저 온다.
 * 이미 다른 사람 몫으로 고른 영상은 비용이 더 들지 않으므로 넘쳐도 그 사람에게도 센다. 고른 묶음 id를 고른 순서대로 돌려준다
 */
export function allocateLinkVideos(users: { sources: number[] }[], picks: Map<number, VideoPick>, perUserSeconds: number = LINK_VIDEO.perUserSeconds): number[] {
  const accepted: number[] = [];
  const taken = new Set<number>();
  for (const u of users) {
    let used = 0;
    const mine = [...new Set(u.sources)].map((s) => picks.get(s)).filter((p): p is VideoPick => !!p).sort((a, b) => a.publishedAt - b.publishedAt);
    for (const p of mine) {
      if (taken.has(p.clusterId)) {
        used += p.seconds;
        continue;
      }
      if (used + p.seconds > perUserSeconds) continue;
      used += p.seconds;
      taken.add(p.clusterId);
      accepted.push(p.clusterId);
    }
  }
  return accepted;
}

/** 남은 하루 예산(달러) 안에서 앞에서부터. 넘는 영상은 다음 날로 */
export function withinBudget(clusterIds: number[], seconds: Map<number, number>, remainingUsd: number): number[] {
  const out: number[] = [];
  let left = remainingUsd;
  for (const id of clusterIds) {
    const cost = estimateVideoUsd(seconds.get(id) ?? LINK_VIDEO.maxSeconds);
    if (cost > left) continue;
    left -= cost;
    out.push(id);
  }
  return out;
}
