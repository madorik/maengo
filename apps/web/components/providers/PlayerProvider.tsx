"use client";

import type { Chapter, Persona, Voice } from "@maengo/core/types";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { savePlayerPrefs } from "@/app/actions";
import {
  isSkipped, lineAt, nextPlayable, prevPlayable, progress as progressOf, startIndex, tick, type Progress,
} from "@/lib/player/machine";
import { ttsErrorMessage } from "@/lib/player/tts-error";
import { PLAYLIST_MAX, playlistAudioUrl, playlistQuery } from "@/lib/playlist";
import type { EpisodeData, ProfileView } from "@/lib/types";
import { useToday } from "./TodayProvider";

// "오늘 소식 이어 듣기"(PLAN.md 8.3). <audio> 하나에 에피소드 파일 하나만 튼다.
// 파일을 바꿔 끼우지 않으니 첫 탭 이후 잠금 화면·백그라운드에서도 끝까지 이어진다.
// 이 Provider는 (app) 레이아웃에 있어서 /today ↔ /listen을 오가도 재생이 끊기지 않는다.
// 음성은 재생을 누를 때 만든다(Gemini TTS, 소식당 수십 초). 페이지를 열 때는 이미 만든 음성만 미리 받는다.
// 보관함 플레이리스트(playPlaylist)도 같은 <audio>로 튼다: 그동안은 오늘 피드 대신 고른 소식이 챕터가 되고, exitPlaylist로 오늘로 돌아온다.
// 아직 없으면 탭하는 순간 파일 주소를 걸고 play()를 불러 두고(iOS 자동 재생 정책), 서버가 음성을 다 만들면 그대로 재생이 시작된다.

type Status = "idle" | "playing" | "paused" | "done";

export interface PlayerApi {
  /** 플랜상 들을 수 있는지 */
  enabled: boolean;
  /** 에피소드 정보를 받아 왔는지 */
  ready: boolean;
  /** 음성을 만드는 중(처음 듣는 말투·소식) */
  preparing: boolean;
  /** 오늘 소식 전부의 음성이 이미 있는지(지금 말투·목소리) */
  audioReady: boolean;
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
  /** 보관함에서 고른 소식(고른 순서). null이면 오늘 피드를 듣는다 */
  playlist: number[] | null;
  /** 고른 소식을 이어 듣는다(Premium). 탭 안에서 불러야 한다(iOS 자동 재생 정책) */
  playPlaylist: (ids: number[]) => void;
  /** 플레이리스트를 닫고 오늘 피드 듣기로 돌아온다 */
  exitPlaylist: () => void;
}

const RATES = [1, 1.2, 1.5, 0.8];
const LOAD_ERROR = "오늘 브리핑을 불러오지 못했어요. 새로고침한 뒤 다시 눌러 주세요.";
const PLAY_ERROR = "재생을 시작하지 못했어요. 재생 버튼을 한 번 더 눌러 주세요.";

const PlayerContext = createContext<PlayerApi | null>(null);
/** 플레이리스트는 직접 고른 소식이라 읽은 소식 건너뛰기를 하지 않는다 */
const NO_READ: ReadonlySet<number> = new Set();

export function PlayerProvider({ profile, children }: { profile: ProfileView; children: React.ReactNode }) {
  const { data, read, markListened } = useToday();
  const audioRef = useRef<HTMLAudioElement>(null);
  /** 메타데이터가 오기 전에 요청된 이동(항목 번호). loadedmetadata에서 그때의 챕터 표로 적용한다 */
  const pendingRef = useRef<{ index: number; play: boolean } | null>(null);
  /** 음성을 만들며 연 파일이면, 다 받은 뒤 실제 길이로 챕터 표를 다시 받는다 */
  const refreshRef = useRef<{ persona: Persona; voice: Voice } | null>(null);
  const loadSeq = useRef(0);
  /** playOne으로 시작한 항목. 이 항목이 끝나면 자동 재생 설정과 관계없이 멈춘다 */
  const onceRef = useRef<number | null>(null);

  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [cur, setCur] = useState(-1);
  const [posMs, setPosMs] = useState(0);
  const [persona, setPersonaState] = useState(profile.persona);
  const [voice, setVoiceState] = useState(profile.voice);
  const [autoNext, setAutoNextState] = useState(profile.autoNext);
  const [skipRead, setSkipReadState] = useState(profile.skipRead);
  const [rate, setRate] = useState(1);
  const [playlist, setPlaylist] = useState<number[] | null>(null);
  /** 지금 듣는 플레이리스트(비동기 콜백에서 읽는다) */
  const playlistRef = useRef<number[] | null>(null);
  // 플레이리스트를 들을 때는 읽은 소식도 건너뛰지 않는다
  const readSet = playlist ? NO_READ : read;
  const skip = playlist ? false : skipRead;

  const enabled = profile.audio && (playlist !== null || data.items.length > 0);
  const chapters = episode?.chapters ?? [];
  const contentKey = data.items.map((i) => `${i.clusterId}:${i.why}`).join("|");

  const fetchEpisode = useCallback(async (p: Persona, v: Voice): Promise<EpisodeData> => {
    const ids = playlistRef.current;
    const res = await fetch(ids ? `/api/episode/playlist?${playlistQuery(ids, v)}` : `/api/episode/today?persona=${p}&voice=${v}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, []);

  /** 파일을 걸고 재생을 건다. 음성이 아직 없으면 이 요청에서 서버가 만든다 */
  const openFile = useCallback((ep: Pick<EpisodeData, "audioUrl" | "ready" | "persona" | "voice">, index: number, play: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    pendingRef.current = index >= 0 ? { index, play } : null;
    refreshRef.current = ep.ready ? null : { persona: ep.persona, voice: ep.voice };
    if (!ep.ready) setPreparing(true);
    audio.src = ep.audioUrl;
    audio.load();
    // 탭 안에서 play()를 불러 둔다. 음성을 만드는 동안 기다렸다가 시작된다
    if (play && !ep.ready) audio.play().catch(() => {});
  }, []);

  const load = useCallback(async (p: Persona, v: Voice, keep: { index: number; resume: boolean }) => {
    const seq = ++loadSeq.current;
    try {
      const ep = await fetchEpisode(p, v);
      const audio = audioRef.current;
      if (seq !== loadSeq.current || !audio) return;
      setError(null);
      setPreparing(false);
      setEpisode(ep);
      const index = Math.min(keep.index, ep.chapters.length - 1);
      if (index < 0) {
        setStatus("idle");
        setCur(-1);
        setPosMs(0);
      }
      if (ep.ready || keep.resume) {
        openFile(ep, index, keep.resume);
      } else {
        // 아직 음성이 없다. 재생을 누를 때 만든다(지금 만들면 듣지 않을 음성에 비용이 든다)
        pendingRef.current = null;
        refreshRef.current = null;
        audio.removeAttribute("src");
        audio.load();
      }
    } catch {
      if (seq === loadSeq.current) setError(LOAD_ERROR);
    }
  }, [fetchEpisode, openFile]);

  // 말투·목소리의 최신 값. 피드 내용이 바뀌어 다시 불러올 때만 읽는다.
  const prefsRef = useRef({ persona, voice });
  useEffect(() => {
    prefsRef.current = { persona, voice };
  });

  // 처음 들어왔을 때, 그리고 피드 내용(why 문구 등)이 바뀌었을 때 에피소드를 새로 받는다.
  // 재생 버튼을 누르는 순간 바로 play()를 부를 수 있게 미리 받아 둔다(iOS는 탭 안에서 play해야 한다).
  useEffect(() => {
    const audio = audioRef.current;
    // 플레이리스트를 듣는 동안은 오늘 피드가 바뀌어도 그대로 둔다(돌아올 때 exitPlaylist가 다시 받는다)
    if (playlistRef.current) return;
    if (!enabled) {
      loadSeq.current++;
      audio?.pause();
      return;
    }
    void load(prefsRef.current.persona, prefsRef.current.voice, { index: -1, resume: false });
  }, [enabled, contentKey, load]);

  /** 음성 파일이 아직 안 걸려 있으면(만들기 전) 재생을 누를 때 건다 */
  const needsFile = () => !!episode && audioRef.current?.getAttribute("src") !== episode.audioUrl;

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
    const audio = audioRef.current;
    if (!ch || !audio || !episode) return;
    onceRef.current = null;
    setError(null);
    enter(index);
    if (needsFile()) return openFile(episode, index, true);
    if (preparing || audio.readyState < 1) {
      // 음성을 만드는 중이면 다 받은 뒤 이 항목으로 간다
      pendingRef.current = { index, play: true };
      return;
    }
    audio.currentTime = ch.startMs / 1000;
    setPosMs(ch.startMs);
    if (audio.paused) startPlayback();
  };

  const playOne = (index: number) => {
    // 이 소식을 듣다 멈춘 거면 멈춘 자리부터 이어서 튼다(처음으로 돌아가지 않게).
    // 전체 듣기 중에 멈췄다면 이어서 튼 뒤에도 다음 소식으로 계속 간다
    const ch = chapters[index];
    if (cur === index && status === "paused" && ch && posMs >= ch.startMs && posMs < ch.endMs && !needsFile() && !preparing) {
      setError(null);
      startPlayback();
      return;
    }
    goTo(index);
    onceRef.current = index;
  };

  const play = () => {
    if (!episode || !chapters.length) return;
    onceRef.current = null;
    if (status === "done" || cur < 0 || needsFile()) {
      goTo(status === "done" || cur < 0 ? startIndex(chapters, readSet, skip) : cur);
      return;
    }
    enter(cur);
    startPlayback();
  };

  const pause = () => audioRef.current?.pause();

  const nextIndex = nextPlayable(chapters, cur + 1, readSet, skip);
  const next = () => {
    if (nextIndex !== null) goTo(nextIndex);
  };

  const prev = () => {
    if (cur < 0) return;
    // 3초 넘게 들었으면 이 항목 처음으로, 아니면 앞 항목으로
    if (posMs - chapters[cur]!.startMs > 3000) return goTo(cur);
    goTo(prevPlayable(chapters, cur - 1, readSet, skip) ?? cur);
  };

  const restart = () => goTo(startIndex(chapters, readSet, skip));

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

  const playPlaylist = (ids: number[]) => {
    const audio = audioRef.current;
    const list = ids.slice(0, PLAYLIST_MAX);
    if (!audio || !profile.audio || !list.length) return;
    playlistRef.current = list;
    setPlaylist(list);
    const seq = ++loadSeq.current;
    onceRef.current = null;
    setError(null);
    setEpisode(null);
    setStatus("idle");
    setCur(0);
    setPosMs(0);
    // 주소는 고른 소식·목소리로 정해진다. 탭 안에서 걸고 play()를 불러 둔다(음성이 없으면 서버가 만든 뒤 시작된다).
    // 파일을 다 받으면 실제 길이로 챕터 표를 다시 받는다(onLoadedMetadata)
    openFile({ audioUrl: playlistAudioUrl(list, voice), ready: false, persona, voice }, 0, true);
    // 음성을 만드는 동안에도 제목·목록이 보이게 어림값 챕터 표를 먼저 받아 둔다
    fetchEpisode(persona, voice)
      .then((ep) => {
        if (seq === loadSeq.current) setEpisode((now) => now ?? ep);
      })
      .catch(() => {});
  };

  const exitPlaylist = () => {
    if (!playlistRef.current) return;
    audioRef.current?.pause();
    playlistRef.current = null;
    setPlaylist(null);
    setEpisode(null);
    setPreparing(false);
    setError(null);
    setStatus("idle");
    setCur(-1);
    setPosMs(0);
    void load(persona, voice, { index: -1, resume: false });
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
    const t = tick(chapters, cur, ms, readSet, { autoNext: autoNext && onceRef.current === null, skipRead: skip });
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
    const refresh = refreshRef.current;
    refreshRef.current = null;
    setPreparing(false);
    const apply = (chs: Chapter[]) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      if (playlistRef.current && chs[pending.index]) markListened(chs[pending.index]!.clusterId);
      const ms = chs[pending.index]?.startMs ?? 0;
      audio.currentTime = ms / 1000;
      setPosMs(ms);
      if (pending.play) startPlayback();
    };
    if (!refresh) return apply(chapters);
    // 방금 만든 음성의 실제 길이로 챕터 표를 다시 받는다(만들기 전에는 글자 수로 어림했다)
    const seq = loadSeq.current;
    fetchEpisode(refresh.persona, refresh.voice)
      .then((ep) => {
        if (seq !== loadSeq.current) return;
        setEpisode(ep);
        apply(ep.chapters);
      })
      .catch(() => apply(chapters));
  };

  const api: PlayerApi = {
    enabled,
    ready: !!episode,
    preparing,
    audioReady: !!episode?.ready,
    error,
    status,
    chapters,
    cur,
    posMs,
    progress: progressOf(chapters, cur, posMs, readSet, skip),
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
      return est.reduce((sum, ms, i) => (chapters[i] && isSkipped(chapters[i]!, readSet, skip) ? sum : sum + ms), 0);
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
    playlist,
    playPlaylist,
    exitPlaylist,
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
      title: title ?? (playlist ? `플레이리스트 ${episode.chapters.length}개` : `오늘 ${episode.chapters.length}개 이어 듣기`),
      artist: "맹고",
      album: playlist ? "보관함 플레이리스트" : "오늘 브리핑",
      artwork: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
    });
  }, [episode, title, playlist]);
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
          if (!audioRef.current?.getAttribute("src")) return;
          if (preparing) void ttsErrorMessage().then(setError);
          else setError(LOAD_ERROR);
          setPreparing(false);
          // 실패한 파일은 떼어 내서 다음 재생 때 다시 만들게 한다
          audioRef.current.removeAttribute("src");
          pendingRef.current = null;
          refreshRef.current = null;
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
