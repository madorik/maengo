"use client";

import { useSyncExternalStore } from "react";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { IDLE_ITEM, itemAudio } from "@/lib/player/item-audio";
import { itemQuery } from "@/lib/player/item";
import { lineAt } from "@/lib/player/machine";
import type { ListenBarCtl } from "./ListenBar";

/**
 * 글 하나만 듣기(지난 글, 그리고 오늘 전체 음성이 아직 없을 때의 오늘 글). 오늘 브리핑 플레이어와 따로, 이 글 하나짜리 파일을 튼다.
 * 파일 주소가 정해져 있어서 탭하는 순간 바로 play()를 걸 수 있다(iOS). 음성이 없으면 그 요청에서 서버가 만든다.
 * 소리는 앱에 하나 있는 오디오(lib/player/item-audio.ts)에서 나서, 오늘 카드에서 듣다가 상세로 가도 이어지고 상세의 듣기 막대가 그 상태를 본다.
 * 재생 속도는 플레이어와 같은 값(프로필에 저장)을 쓴다. 잠금 화면 버튼·속도·목소리 바꾸기는 components/app/ItemAudioHost.tsx
 */
export function useItemAudio(clusterId: number, enabled: boolean): { ctl: ListenBarCtl; activePara: number | undefined } {
  const p = usePlayer();
  // 이 글 하나를 듣기 시작하면 '들음'으로 기록한다(화면에는 읽음으로 보인다). 오늘 브리핑 플레이어와 같은 규칙
  const { markListened } = useToday();
  const s = useSyncExternalStore(itemAudio.subscribe, itemAudio.snapshot, () => IDLE_ITEM);
  // 다른 소식이 걸려 있으면 이 소식은 처음 상태로 보인다
  const mine = s.clusterId === clusterId ? s : IDLE_ITEM;
  const query = itemQuery(clusterId, p.persona, p.voice);
  const rate = p.rate;

  const play = () => {
    if (!enabled) return;
    p.pause(); // 오늘 브리핑이 돌고 있었다면 멈춘다
    itemAudio.play(clusterId, query, rate, markListened);
  };
  const active = mine.status === "playing" || mine.status === "paused";

  return {
    activePara: active && mine.chapter ? mine.chapter.lines[lineAt(mine.chapter, mine.posMs)]?.para : undefined,
    ctl: {
      state: !enabled ? "locked" : mine.status === "done" ? "finished" : active ? mine.status : "idle",
      ready: true,
      preparing: mine.preparing,
      error: mine.error,
      elapsedMs: mine.posMs,
      totalMs: mine.chapter ? mine.chapter.endMs - mine.chapter.startMs : 0,
      play,
      pause: () => {
        if (itemAudio.snapshot().clusterId === clusterId) itemAudio.pause();
      },
      rate,
      cycleRate: p.cycleRate,
      seek: (ms) => itemAudio.seek(clusterId, ms),
      skip: (deltaMs) => itemAudio.seek(clusterId, mine.posMs + deltaMs),
      /** 음성을 기다리는 중에 그만둔다. 파일을 떼어 내서 다 만들어져도 저절로 시작하지 않는다 */
      cancel: () => itemAudio.cancel(clusterId),
      retry: play,
    },
  };
}
