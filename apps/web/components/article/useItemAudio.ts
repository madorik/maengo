"use client";

import { track } from "@/lib/analytics";
import type { Chapter } from "@maengo/core/types";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { hideMedia, showMedia, type MediaAction } from "@/lib/native/media";
import { lineAt } from "@/lib/player/machine";
import { ttsErrorMessage } from "@/lib/player/tts-error";
import type { ListenBarCtl } from "./ListenBar";

const RATES = [1, 1.2, 1.5, 0.8];
const ITEM_PLAY_EVENT = "maengo:item-play";

/**
 * 글 하나만 듣기(지난 글, 그리고 오늘 전체 음성이 아직 없을 때의 오늘 글). 오늘 브리핑 플레이어와 따로, 이 글 하나짜리 파일을 튼다.
 * 파일 주소가 정해져 있어서 탭하는 순간 바로 play()를 걸 수 있다(iOS). 음성이 없으면 그 요청에서 서버가 만든다.
 */
export function useItemAudio(clusterId: number, enabled: boolean): { ctl: ListenBarCtl; activePara: number | undefined } {
  const p = usePlayer();
  // 이 글 하나를 듣기 시작하면 '들음'으로 기록한다(화면에는 읽음으로 보인다). 오늘 브리핑 플레이어와 같은 규칙
  const { markListened } = useToday();
  const markRef = useRef(markListened);
  useEffect(() => {
    markRef.current = markListened;
  }, [markListened]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [posMs, setPosMs] = useState(0);
  const [rate, setRate] = useState(1);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 재생 위치를 옮긴 횟수. 안드로이드 알림의 재생 위치를 맞출 때만 쓴다 */
  const [seeks, setSeeks] = useState(0);
  const query = `id=${clusterId}&persona=${p.persona}&voice=${p.voice}`;

  useEffect(() => {
    if (!enabled) return;
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    const onTime = () => setPosMs(a.currentTime * 1000);
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "done" ? s : "paused"));
    const onSeeked = () => setSeeks((n) => n + 1);
    const onEnded = () => {
      setStatus("done");
      track("listen_complete", { mode: "item" });
    };
    let marked = false;
    const onPlaying = () => {
      setPreparing(false);
      if (!marked) {
        marked = true;
        markRef.current(clusterId);
      }
    };
    // 파일이 열린 뒤에 대본 시각표를 받는다(그때는 음성이 다 만들어져 있어 실제 시각이 나온다)
    const onMeta = () => {
      const q = a.dataset.query;
      if (!q) return;
      fetch(`/api/episode/item?${q}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { chapter: Chapter } | null) => d && setChapter(d.chapter))
        .catch(() => {});
    };
    const onError = () => {
      if (!a.getAttribute("src")) return;
      setPreparing(false);
      setStatus("idle");
      a.removeAttribute("src");
      delete a.dataset.query;
      void ttsErrorMessage().then(setError);
    };
    a.addEventListener("loadedmetadata", onMeta);
    // 다른 글 하나짜리 재생이 시작되면 이 글은 멈춘다
    const onOther = (e: Event) => {
      if ((e as CustomEvent<number>).detail !== clusterId) a.pause();
    };
    window.addEventListener(ITEM_PLAY_EVENT, onOther);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("error", onError);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("seeked", onSeeked);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("seeked", onSeeked);
      window.removeEventListener(ITEM_PLAY_EVENT, onOther);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onError);
    };
  }, [enabled, clusterId]);

  // 듣는 중에 말투·목소리를 바꾸면 새 목소리로 처음부터 다시 튼다
  useEffect(() => {
    const a = audioRef.current;
    if (!a?.dataset.query || a.dataset.query === query) return;
    const wasPlaying = !a.paused;
    a.dataset.query = query;
    a.src = `/api/episode/item/audio?${query}`;
    setPreparing(true);
    if (wasPlaying) a.play().catch(() => {});
  }, [query]);

  const play = () => {
    const a = audioRef.current;
    if (!a) return;
    p.pause(); // 오늘 브리핑이 돌고 있었다면 멈춘다
    window.dispatchEvent(new CustomEvent(ITEM_PLAY_EVENT, { detail: clusterId }));
    if (a.dataset.query !== query) {
      // 처음 듣는 말투면 이 요청에서 음성을 만든다(수십 초). 대본 시각표는 파일이 열린 뒤에 받는다
      a.dataset.query = query;
      a.src = `/api/episode/item/audio?${query}`;
      setPreparing(true);
      setError(null);
    }
    if (status === "done") a.currentTime = 0;
    if (status === "idle" || status === "done") track("listen_start", { mode: "item" });
    a.playbackRate = rate;
    a.play().catch(() => {});
  };

  const active = status === "playing" || status === "paused";

  // 잠금 화면·이어폰·안드로이드 알림 버튼(lib/native/media.ts). 오늘 브리핑 플레이어와 자리를 나눠 쓴다
  const actionRef = useRef<(action: MediaAction, seekTime?: number) => void>(() => {});
  useEffect(() => {
    actionRef.current = (action, seekTime) => {
      const a = audioRef.current;
      if (action === "play") return play();
      if (action === "pause") return a?.pause();
      if (!a) return;
      if (action === "seekbackward") a.currentTime = Math.max(0, a.currentTime - 15);
      else if (action === "seekforward") a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 15);
      else if (action === "seekto" && seekTime !== undefined) a.currentTime = seekTime;
      else if (action === "previoustrack") a.currentTime = 0;
    };
  });
  const who = `item:${clusterId}`;
  useEffect(() => {
    if (!enabled || !active) return hideMedia(who);
    const a = audioRef.current;
    showMedia(
      who,
      {
        title: chapter?.title ?? "맹고 소식",
        album: "소식 듣기",
        playing: status === "playing",
        position: a?.currentTime ?? 0,
        duration: a && Number.isFinite(a.duration) ? a.duration : 0,
        rate,
      },
      (action, seekTime) => actionRef.current(action, seekTime),
    );
  }, [who, enabled, active, status, chapter, rate, seeks]);
  useEffect(() => () => hideMedia(who), [who]);

  return {
    activePara: active && chapter ? chapter.lines[lineAt(chapter, posMs)]?.para : undefined,
    ctl: {
      state: !enabled ? "locked" : status === "done" ? "finished" : active ? status : "idle",
      ready: true,
      preparing,
      error,
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
