"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { hideMedia, showMedia, type MediaAction } from "@/lib/native/media";
import { IDLE_ITEM, itemAudio } from "@/lib/player/item-audio";
import { itemQuery } from "@/lib/player/item";

/**
 * 글 하나 듣기(lib/player/item-audio.ts)의 화면 밖 일: 잠금 화면·이어폰·안드로이드 알림 버튼, 재생 속도, 목소리 바꾸기.
 * (app) 레이아웃에 있어 듣던 소식의 카드·상세를 떠나도(다른 화면으로 옮겨도) 잠금 화면에서 멈추고 옮길 수 있다.
 * 잠금 화면 자리는 오늘 브리핑 플레이어와 나눠 쓴다(lib/native/media.ts)
 */
export function ItemAudioHost() {
  const p = usePlayer();
  const { markListened } = useToday();
  const s = useSyncExternalStore(itemAudio.subscribe, itemAudio.snapshot, () => IDLE_ITEM);
  const rate = p.rate;

  // 플레이어에서 속도를 바꿨거나 듣기 막대에서 바꾸면 듣던 소리도 그 속도로
  useEffect(() => itemAudio.setRate(rate), [rate]);

  // 듣는 중에 목소리를 바꾸면 새 목소리로 처음부터 다시 튼다
  const clusterId = s.clusterId;
  useEffect(() => {
    if (clusterId !== null) itemAudio.switchQuery(itemQuery(clusterId, p.persona, p.voice));
  }, [clusterId, p.persona, p.voice]);

  const actionRef = useRef<(action: MediaAction, seekTime?: number) => void>(() => {});
  useEffect(() => {
    actionRef.current = (action, seekTime) => {
      const a = itemAudio.element();
      const now = itemAudio.snapshot();
      if (action === "play") {
        if (now.clusterId !== null && now.query) itemAudio.play(now.clusterId, now.query, rate, markListened);
        return;
      }
      if (action === "pause") return a?.pause();
      if (!a) return;
      if (action === "seekbackward") a.currentTime = Math.max(0, a.currentTime - 15);
      else if (action === "seekforward") a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 15);
      else if (action === "seekto" && seekTime !== undefined) a.currentTime = seekTime;
      else if (action === "previoustrack") a.currentTime = 0;
    };
  });

  const who = clusterId === null ? null : `item:${clusterId}`;
  const active = s.status === "playing" || s.status === "paused";
  useEffect(() => {
    if (!who) return;
    if (!active) return hideMedia(who);
    const a = itemAudio.element();
    showMedia(
      who,
      {
        title: s.chapter?.title ?? "맹고 소식",
        album: "소식 듣기",
        playing: s.status === "playing",
        position: a?.currentTime ?? 0,
        duration: a && Number.isFinite(a.duration) ? a.duration : 0,
        rate,
      },
      (action, seekTime) => actionRef.current(action, seekTime),
    );
  }, [who, active, s.status, s.chapter, rate, s.seeks]);
  useEffect(() => () => (who ? hideMedia(who) : undefined), [who]);

  return null;
}
