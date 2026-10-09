"use client";

import type { Chapter, Persona, Voice } from "@maengo/core/types";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { savePlayerPrefs } from "@/app/actions";
import {
  isSkipped, lineAt, nextPlayable, prevPlayable, progress as progressOf, startIndex, tick, type Progress,
} from "@/lib/player/machine";
import type { EpisodeData, ProfileView } from "@/lib/types";
import { useToday } from "./TodayProvider";

// "오늘 소식 이어 듣기"(PLAN.md 8.3). <audio> 하나에 에피소드 파일 하나만 튼다.
// 파일을 바꿔 끼우지 않으니 첫 탭 이후 잠금 화면·백그라운드에서도 끝까지 이어진다.
// 이 Provider는 (app) 레이아웃에 있어서 /today ↔ /listen을 오가도 재생이 끊기지 않는다.

type Status = "idle" | "playing" | "paused" | "done";

export interface PlayerApi {
  /** 플랜상 들을 수 있는지 */
  enabled: boolean;
  /** 에피소드 정보를 받아 왔는지 */
  ready: boolean;
  error: string | null;
  status: Status;
  chapters: Chapter[];
  cur: number;
  posMs: number;
  progress: Progress;
  lineIndex: number;
  persona: Persona;
  voice: Voice;
  autoNext: boolean;
  skipRead: boolean;
  rate: number;
  canPrev: boolean;
  canNext: boolean;
  /** 말투별 전체 길이 어림값. 읽은 항목 건너뛰기를 반영한다 */
  personaTotalMs: (p: Persona) => number | null;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  goTo: (index: number) => void;
  /** 이 항목 하나만 듣고 멈춘다(레슨 화면의 스피커 버튼) */
  playOne: (index: number) => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  setPersona: (p: Persona) => void;
  setVoice: (v: Voice) => void;
  setAutoNext: (on: boolean) => void;
  setSkipRead: (on: boolean) => void;
  cycleRate: () => void;
}

const RATES = [1, 1.2, 1.5, 0.8];
const LOAD_ERROR = "오늘 브리핑을 불러오지 못했어요. 새로고침한 뒤 다시 눌러 주세요.";
const PLAY_ERROR = "재생을 시작하지 못했어요. 재생 버튼을 한 번 더 눌러 주세요.";

const PlayerContext = createContext<PlayerApi | null>(null);

export function PlayerProvider({ profile, children }: { profile: ProfileView; children: React.ReactNode }) {
  const { data, read, markListened } = useToday();
  const audioRef = useRef<HTMLAudioElement>(null);
  /** 메타데이터가 오기 전에 요청된 이동. loadedmetadata에서 적용한다 */
  const pendingRef = useRef<{ ms: number; play: boolean } | null>(null);
  const loadSeq = useRef(0);
  /** playOne으로 시작한 항목. 이 항목이 끝나면 자동 재생 설정과 관계없이 멈춘다 */
  const onceRef = useRef<number | null>(null);

  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [cur, setCur] = useState(-1);
  const [posMs, setPosMs] = useState(0);
  const [persona, setPersonaState] = useState(profile.persona);
  const [voice, setVoiceState] = useState(profile.voice);
  const [autoNext, setAutoNextState] = useState(profile.autoNext);
  const [skipRead, setSkipReadState] = useState(profile.skipRead);
  const [rate, setRate] = useState(1);

  const enabled = profile.audio && data.items.length > 0;
  const chapters = episode?.chapters ?? [];
  const contentKey = data.items.map((i) => `${i.clusterId}:${i.why}`).join("|");

  const load = useCallback(async (p: Persona, v: Voice, keep: { index: number; resume: boolean }) => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`/api/episode/today?persona=${p}&voice=${v}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const ep: EpisodeData = await res.json();
      const audio = audioRef.current;
      if (seq !== loadSeq.current || !audio) return;
      setError(null);
      setEpisode(ep);
      const index = Math.min(keep.index, ep.chapters.length - 1);
      if (index < 0) {
        setStatus("idle");
        setCur(-1);
        setPosMs(0);
      }
      pendingRef.current = index >= 0 ? { ms: ep.chapters[index]!.startMs, play: keep.resume } : null;
      audio.src = ep.audioUrl;
      audio.load();
    } catch {
      if (seq === loadSeq.current) setError(LOAD_ERROR);
    }
  }, []);

  // 말투·목소리의 최신 값. 피드 내용이 바뀌어 다시 불러올 때만 읽는다.
  const prefsRef = useRef({ persona, voice });
  useEffect(() => {
    prefsRef.current = { persona, voice };
  });

  // 처음 들어왔을 때, 그리고 피드 내용(why 문구 등)이 바뀌었을 때 에피소드를 새로 받는다.
  // 재생 버튼을 누르는 순간 바로 play()를 부를 수 있게 미리 받아 둔다(iOS는 탭 안에서 play해야 한다).
  useEffect(() => {
    const audio = audioRef.current;
    if (!enabled) {
      loadSeq.current++;
      audio?.pause();
      return;
    }
    void load(prefsRef.current.persona, prefsRef.current.voice, { index: -1, resume: false });
  }, [enabled, contentKey, load]);

  const seek = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.readyState >= 1) audio.currentTime = ms / 1000;
    else pendingRef.current = { ms, play: false };
    setPosMs(ms);
  };

  const startPlayback = () => {
    audioRef.current?.play().catch(() => setError(PLAY_ERROR));
  };

  const enter = (index: number) => {
    setCur(index);
    const ch = chapters[index];
    if (ch) markListened(ch.clusterId);
  };

  const goTo = (index: number) => {
    const ch = chapters[index];
    if (!ch) return;
    onceRef.current = null;
    seek(ch.startMs);
    enter(index);
    if (audioRef.current?.paused) startPlayback();
  };

  const playOne = (index: number) => {
    goTo(index);
    onceRef.current = index;
  };

  const play = () => {
    if (!episode || !chapters.length) return;
    onceRef.current = null;
    if (status === "done" || cur < 0) {
      goTo(startIndex(chapters, read, skipRead));
      return;
    }
    enter(cur);
    startPlayback();
  };

  const pause = () => audioRef.current?.pause();

  const nextIndex = nextPlayable(chapters, cur + 1, read, skipRead);
  const next = () => {
    if (nextIndex !== null) goTo(nextIndex);
  };

  const prev = () => {
    if (cur < 0) return;
    // 3초 넘게 들었으면 이 항목 처음으로, 아니면 앞 항목으로
    if (posMs - chapters[cur]!.startMs > 3000) return goTo(cur);
    goTo(prevPlayable(chapters, cur - 1, read, skipRead) ?? cur);
  };

  const restart = () => goTo(startIndex(chapters, read, skipRead));

  const setPersona = (p: Persona) => {
    if (p === persona) return;
    setPersonaState(p);
    void savePlayerPrefs({ persona: p });
    void load(p, voice, { index: cur, resume: status === "playing" });
  };

  const setVoice = (v: Voice) => {
    if (v === voice) return;
    setVoiceState(v);
    void savePlayerPrefs({ voice: v });
    if (persona !== "dialogue") void load(persona, v, { index: cur, resume: status === "playing" });
  };

  const setAutoNext = (on: boolean) => {
    setAutoNextState(on);
    void savePlayerPrefs({ autoNext: on });
  };

  const setSkipRead = (on: boolean) => {
    setSkipReadState(on);
    void savePlayerPrefs({ skipRead: on });
  };

  const cycleRate = () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    const ms = audio.currentTime * 1000;
    setPosMs(ms);
    if (audio.paused || !chapters.length) return;
    const t = tick(chapters, cur, ms, read, { autoNext: autoNext && onceRef.current === null, skipRead });
    if (t.kind === "hold" || t.kind === "end") onceRef.current = null;
    switch (t.kind) {
      case "enter":
        enter(t.index);
        break;
      case "hold":
        audio.pause();
        audio.currentTime = t.atMs / 1000;
        setCur(t.index);
        setPosMs(t.atMs);
        break;
      case "skip":
        audio.currentTime = t.toMs / 1000;
        enter(t.index);
        break;
      case "end":
        audio.pause();
        setStatus("done");
        setCur(-1);
        break;
    }
  };

  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    audio.playbackRate = rate;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    audio.currentTime = pending.ms / 1000;
    setPosMs(pending.ms);
    if (pending.play) startPlayback();
  };

  const api: PlayerApi = {
    enabled,
    ready: !!episode,
    error,
    status,
    chapters,
    cur,
    posMs,
    progress: progressOf(chapters, cur, posMs, read, skipRead),
    lineIndex: lineAt(chapters[cur], posMs),
    persona,
    voice,
    autoNext,
    skipRead,
    rate,
    canPrev: cur >= 0,
    canNext: nextIndex !== null,
    personaTotalMs: (p) => {
      const est = episode?.estimates[p];
      if (!est) return null;
      return est.reduce((sum, ms, i) => (chapters[i] && isSkipped(chapters[i]!, read, skipRead) ? sum : sum + ms), 0);
    },
    toggle: () => (status === "playing" ? pause() : play()),
    play,
    pause,
    goTo,
    playOne,
    next,
    prev,
    restart,
    setPersona,
    setVoice,
    setAutoNext,
    setSkipRead,
    cycleRate,
  };

  // 잠금 화면·이어폰 버튼(Media Session). 핸들러는 늘 최신 api를 부르도록 ref로 넘긴다.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  const title = chapters[cur]?.title;
  useEffect(() => {
    if (!episode || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title ?? `오늘 ${episode.chapters.length}개 이어 듣기`,
      artist: "맹고",
      album: "오늘 브리핑",
      artwork: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
    });
  }, [episode, title]);
  useEffect(() => {
    if (!episode || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => apiRef.current.play()],
      ["pause", () => apiRef.current.pause()],
      ["previoustrack", () => apiRef.current.prev()],
      ["nexttrack", () => apiRef.current.next()],
      ["seekbackward", () => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 15);
      }],
      ["seekforward", () => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 15);
      }],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // 지원하지 않는 동작은 건너뛴다
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {}
      }
    };
  }, [episode]);

  return (
    <PlayerContext.Provider value={api}>
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setStatus("playing")}
        onPause={() => setStatus((s) => (s === "done" ? s : "paused"))}
        onEnded={() => {
          setStatus("done");
          setCur(-1);
        }}
        onError={() => {
          if (audioRef.current?.getAttribute("src")) setError(LOAD_ERROR);
        }}
        hidden
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer는 PlayerProvider 안에서만 쓸 수 있어요");
  return ctx;
}
