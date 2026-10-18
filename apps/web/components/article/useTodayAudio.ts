"use client";

import { useRouter } from "next/navigation";
import { usePlayer } from "@/components/providers/PlayerProvider";
import type { FeedItem } from "@/lib/types";
import type { ListenBarCtl } from "./ListenBar";

/**
 * 오늘 글 듣기: 오늘 브리핑 플레이어로 이 글 하나만 듣는다.
 * 플레이어 목록에서 번호가 아니라 소식으로 찾는다(듣는 동안 피드가 늘어도 플레이어 목록은 듣기가 끝날 때까지 그대로라서)
 */
export function useTodayAudio(clusterId: number, next?: FeedItem): { ctl: ListenBarCtl; activePara: number | undefined } {
  const p = usePlayer();
  const router = useRouter();
  const index = p.chapters.findIndex((c) => c.clusterId === clusterId);
  const ch = p.chapters[index];
  const current = index >= 0 && p.cur === index && p.status !== "done";
  // 이 글을 끝까지 들으면 플레이어가 다음 글 시작점에서 멈춰 있다
  const finished = !!ch && p.status === "paused" && p.cur === index + 1 && Math.abs(p.posMs - ch.endMs) < 500;
  const nextIndex = next ? p.chapters.findIndex((c) => c.clusterId === next.clusterId) : -1;
  const elapsedMs = current && ch ? Math.max(0, p.posMs - ch.startMs) : 0;
  const totalMs = ch ? ch.endMs - ch.startMs : 0;
  // 이 글 안에서만 옮긴다(막대가 이 글 하나의 길이라서)
  const seek = (ms: number) => {
    if (ch) p.seekTo(ch.startMs + Math.min(Math.max(0, ms), Math.max(0, totalMs - 500)));
  };
  return {
    activePara: current ? ch?.lines[p.lineIndex]?.para : undefined,
    ctl: {
      state: !p.enabled ? "locked" : current ? (p.status === "playing" ? "playing" : "paused") : finished ? "finished" : "idle",
      ready: p.ready && index >= 0,
      preparing: p.preparing && current,
      error: current || p.cur < 0 ? p.error : null,
      elapsedMs,
      totalMs,
      play: () => p.playOne(index),
      pause: p.pause,
      rate: p.rate,
      cycleRate: p.cycleRate,
      seek,
      skip: (deltaMs) => seek(elapsedMs + deltaMs),
      cancel: p.cancel,
      // 에피소드를 못 받았으면 다시 받고, 아니면 이 글을 멈춘 자리부터 다시 튼다
      retry: p.ready && index >= 0 ? () => p.playOne(index) : p.retry,
      next:
        next && nextIndex >= 0
          ? () => {
              p.playOne(nextIndex);
              router.push(`/article/${next.clusterId}`);
            }
          : undefined,
    },
  };
}
