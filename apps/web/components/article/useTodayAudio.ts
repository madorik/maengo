"use client";

import { useRouter } from "next/navigation";
import { usePlayer } from "@/components/providers/PlayerProvider";
import type { FeedItem } from "@/lib/types";
import type { ListenBarCtl } from "./ListenBar";

/** 오늘 글 듣기: 오늘 브리핑 플레이어로 이 글 하나만 듣는다 */
export function useTodayAudio(index: number, next?: FeedItem): { ctl: ListenBarCtl; activePara: number | undefined } {
  const p = usePlayer();
  const router = useRouter();
  const ch = p.chapters[index];
  const current = index >= 0 && p.cur === index && p.status !== "done";
  // 이 글을 끝까지 들으면 플레이어가 다음 글 시작점에서 멈춰 있다
  const finished = !!ch && p.status === "paused" && p.cur === index + 1 && Math.abs(p.posMs - ch.endMs) < 500;
  return {
    activePara: current ? ch?.lines[p.lineIndex]?.para : undefined,
    ctl: {
      state: !p.enabled ? "locked" : current ? (p.status === "playing" ? "playing" : "paused") : finished ? "finished" : "idle",
      ready: p.ready,
      elapsedMs: current && ch ? Math.max(0, p.posMs - ch.startMs) : 0,
      totalMs: ch ? ch.endMs - ch.startMs : 0,
      play: () => p.playOne(index),
      pause: p.pause,
      rate: p.rate,
      cycleRate: p.cycleRate,
      next: next
        ? () => {
            p.playOne(index + 1);
            router.push(`/article/${next.clusterId}`);
          }
        : undefined,
    },
  };
}
