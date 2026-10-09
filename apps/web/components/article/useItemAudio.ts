"use client";

import type { Chapter } from "@maengo/core/types";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { lineAt } from "@/lib/player/machine";
import type { ListenBarCtl } from "./ListenBar";

const RATES = [1, 1.2, 1.5, 0.8];

/**
 * 보관함의 지난 글 듣기. 오늘 브리핑 플레이어와 따로, 이 글 하나짜리 파일을 튼다.
 * 파일 주소가 정해져 있어서 탭하는 순간 바로 play()를 걸 수 있다(iOS).
 */
export function useItemAudio(clusterId: number, enabled: boolean): { ctl: ListenBarCtl; activePara: number | undefined } {
  const p = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [posMs, setPosMs] = useState(0);
  const [rate, setRate] = useState(1);
  const query = `id=${clusterId}&persona=${p.persona}&voice=${p.voice}`;

  useEffect(() => {
    if (!enabled) return;
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    const onTime = () => setPosMs(a.currentTime * 1000);
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "done" ? s : "paused"));
    const onEnded = () => setStatus("done");
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [enabled]);

  const loadMeta = (q: string) => {
    fetch(`/api/episode/item?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { chapter: Chapter } | null) => d && setChapter(d.chapter))
      .catch(() => {});
  };

  // 듣는 중에 말투·목소리를 바꾸면 새 목소리로 처음부터 다시 튼다
  useEffect(() => {
    const a = audioRef.current;
    if (!a?.dataset.query || a.dataset.query === query) return;
    const wasPlaying = !a.paused;
    a.dataset.query = query;
    a.src = `/api/episode/item/audio?${query}`;
    loadMeta(query);
    if (wasPlaying) a.play().catch(() => {});
  }, [query]);

  const play = () => {
    const a = audioRef.current;
    if (!a) return;
    p.pause(); // 오늘 브리핑이 돌고 있었다면 멈춘다
    if (a.dataset.query !== query) {
      a.dataset.query = query;
      a.src = `/api/episode/item/audio?${query}`;
      loadMeta(query);
    }
    if (status === "done") a.currentTime = 0;
    a.playbackRate = rate;
    a.play().catch(() => {});
  };

  const active = status === "playing" || status === "paused";
  return {
    activePara: active && chapter ? chapter.lines[lineAt(chapter, posMs)]?.para : undefined,
    ctl: {
      state: !enabled ? "locked" : status === "done" ? "finished" : active ? status : "idle",
      ready: true,
      elapsedMs: posMs,
      totalMs: chapter ? chapter.endMs - chapter.startMs : 0,
      play,
      pause: () => audioRef.current?.pause(),
      rate,
      cycleRate: () => {
        const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
        setRate(r);
        if (audioRef.current) audioRef.current.playbackRate = r;
      },
    },
  };
}
