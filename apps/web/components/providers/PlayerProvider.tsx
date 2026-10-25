"use client";

import type { Chapter, Persona, Voice } from "@maengo/core/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { savePlayerPrefs } from "@/app/actions";
import {
  chapterAt, heldOffset, lineAt, nextPlayable, positionAt, prevPlayable, progress as progressOf, startIndex, tick, withRealChapter, type Progress,
} from "@/lib/player/machine";
import { ITEM_PLAY_EVENT, itemAudioUrl, itemInfoUrl, itemQuery } from "@/lib/player/item";
import { initialRate, nextRate } from "@/lib/player/rate";
import { keptIds, parseRemoved, planTodaySwap, sameIds, saveRemoved, useRemovedRaw } from "@/lib/player/removed";
import { clearResume, parseResume, resumeTarget, saveResume, useResumeRaw } from "@/lib/player/resume";
import { ttsErrorMessage } from "@/lib/player/tts-error";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { hideMedia, showMedia, type MediaAction } from "@/lib/native/media";
import { PLAYLIST_MAX, playlistAudioUrl, playlistQuery } from "@/lib/playlist";
import { waitUrl } from "@/lib/voice-samples";
import type { EpisodeData, ProfileView } from "@/lib/types";
import { reinsert } from "@/lib/undo";
import { useToast } from "@/components/ui/Toast";
import { useToday } from "./TodayProvider";

// "오늘 소식 이어 듣기"(PLAN.md 8.3). <audio> 하나에 에피소드 파일 하나만 튼다.
// 파일을 바꿔 끼우지 않으니 첫 탭 이후 잠금 화면·백그라운드에서도 끝까지 이어진다.
// 이 Provider는 (app) 레이아웃에 있어서 /today ↔ /listen을 오가도 재생이 끊기지 않는다.
// 음성은 재생을 누를 때 만든다(Gemini TTS, 소식당 수십 초). 페이지를 열 때는 이미 만든 음성만 미리 받는다.
// 플레이리스트(playPlaylist)도 같은 <audio>로 튼다: 그동안은 오늘 피드 대신 고른 소식이 챕터가 되고, exitPlaylist로 오늘로 돌아온다.
// 아직 없으면 탭하는 순간 파일 주소를 걸고 play()를 불러 두고(iOS 자동 재생 정책), 서버가 음성을 다 만들면 그대로 재생이 시작된다.
// 오늘 전체 음성이 아직 없을 때는 기다리지 않게 첫 소식만 먼저 그 소식 하나짜리 파일로 틀고(Lead), 그동안 서버가 나머지를 만든다.
// 첫 소식이 끝나면 같은 <audio>에 전체 파일을 걸어 다음 소식 자리부터 이어 간다. 전체 파일이 아직이면 다 될 때까지 기다린다.

type Status = "idle" | "playing" | "paused" | "done";

/**
 * 첫 소식만 먼저 듣는 동안의 상태. 그 소식 하나짜리 파일을 걸어 두고, 파일 안 시각에 그 챕터 시작 시각을 더해 에피소드 시각으로 쓴다.
 * chapter는 파일이 열린 뒤 받은 실제 대본 시각표(0부터). 그 전에는 어림값 챕터로 보여 준다
 */
interface Lead {
  index: number;
  clusterId: number;
  query: string;
  /** 파일이 열리면 옮겨 갈 자리(이어 듣기) */
  offsetMs: number;
  chapter: Chapter | null;
}

export interface PlayerApi {
  /** 플랜상 들을 수 있는지 */
  enabled: boolean;
  /** 에피소드 정보를 받아 왔는지 */
  ready: boolean;
  /** 에피소드 정보를 받기 전에 재생을 눌러, 받는 대로 시작하려고 기다리는 중 */
  starting: boolean;
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
  /** 재생을 누르면 먼저 나올 항목(듣던 자리 이어 듣기·읽은 소식 건너뛰기 반영) */
  firstIndex: number;
  /** 이 소식을 건너뛰는지. 듣는 동안은 듣기 시작할 때 읽은 소식 기준이다(듣다가 글을 열어도 건너뛰지 않게) */
  skips: (clusterId: number) => boolean;
  /** 진행 막대·±15초로 옮길 수 있는지(듣기를 시작했고 음성을 기다리는 중이 아님) */
  canSeek: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  goTo: (index: number) => void;
  /** 소식을 고른다(이전·다음·재생 목록). 듣는 중이면 이어서 듣고, 아니면 자리만 옮긴다 */
  select: (index: number) => void;
  /** 이 항목 하나만 듣고 멈춘다(레슨 화면의 스피커 버튼) */
  playOne: (index: number) => void;
  /** 에피소드의 한 시각(ms)으로 옮겨 듣는다(대본에서 줄을 누를 때). 멈춰 있었으면 재생한다 */
  seek: (ms: number) => void;
  /** 에피소드의 한 시각(ms)으로 옮긴다. 재생·멈춤은 그대로 */
  seekTo: (ms: number) => void;
  /** 진행 막대의 자리(progress.elapsedMs 단위)로 옮긴다 */
  seekProgress: (elapsedMs: number) => void;
  /** 앞뒤로 옮긴다(±15초 버튼) */
  skipBy: (deltaMs: number) => void;
  /** 음성을 기다리는 중에 그만둔다. 다 만들어져도 저절로 시작하지 않는다 */
  cancel: () => void;
  /** 오류 뒤 다시 시도(탭 안에서 부른다) */
  retry: () => void;
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
  /** 오늘 소식 전체를 플레이어로 듣는다(오늘 카드의 '전체 듣기'). 플레이리스트를 듣는 중이었으면 오늘로 바꿔 바로 튼다 */
  playToday: () => void;
  /** 플레이어 목록 순서를 바꾼다(재생 목록에서 끌어 놓기). 듣던 소식의 듣던 자리에서 이어 간다. 저장된 플레이리스트 순서는 그대로 */
  reorderPlaylist: (ids: number[]) => void;
  /**
   * 플레이어 목록에서 뺀다(저장된 플레이리스트는 그대로). 듣던 소식이면 그 자리에 온 소식으로 넘어간다.
   * 오늘 소식이면 그날 동안 이 기기에서 빼 두고(뺀 소식은 음성을 만들지 않는다), restoreToday로 되돌린다.
   * 뺐으면 그 하나를 되돌리는 함수를 돌려준다(되돌리기 알림): 누를 때의 상태로 뺀 자리에 다시 넣고, 지금 넣을 수 없으면 false.
   * 안 뺐거나 되돌릴 수 없는 빼기(음성을 만드는 중인 소식, 플레이리스트의 마지막 하나)면 null
   */
  removeFromPlayer: (id: number) => (() => boolean) | null;
  /** 오늘 플레이어 목록에서 뺀 소식 */
  removedToday: ReadonlySet<number>;
  /** 오늘 목록에서 뺀 소식을 모두 다시 넣는다 */
  restoreToday: () => void;
  /** 지금 목록에서 빼거나 되돌릴 수 있는지(듣는 중이면 음성 조각이 다 있을 때만) */
  canRemove: boolean;
  /** 플레이어 목록 끝에 붙인다(음성을 미리 만든 뒤). 플레이리스트를 듣는 중이 아니면 이 소식으로 채우고 바로 들려준다 */
  addToPlayer: (items: { clusterId: number; title: string }[]) => void;
  /** 음성을 만드는 중이라 아직 목록에 붙지 않은 소식 */
  pending: { clusterId: number; title: string }[];
  /** 플레이어 목록(또는 추가 대기)에 있는지 */
  inPlayer: (id: number) => boolean;
  /** 지금 목록을 바로 바꿀 수 있는지(음성 조각이 다 있고 만드는 중이 아님) */
  canEdit: boolean;
}

// 오류는 짧게 한 줄로(옆에 '다시 시도' 버튼이 있다)
/** 에피소드 정보(목록·챕터 표)를 못 받았을 때 */
const LOAD_ERROR = "소식을 불러오지 못했어요";
/** 음성을 기다릴 때 안내 소리를 켜기까지 기다리는 시간. 이미 만든 음성은 보통 이 안에 열린다 */
const WAIT_DELAY_MS = 800;
/** 다 만든 음성 파일을 못 열었을 때 */
const FILE_ERROR = "음성을 불러오지 못했어요";
const PLAY_ERROR = "재생하지 못했어요";
const UNDO_ERROR = "되돌리지 못했어요";
/** 음성을 이어 붙이는 동안 눌린 되돌리기를 기다려 주는 시간 */
const UNDO_WAIT_MS = 20_000;
type UndoArgs = { id: number; before: readonly number[] | null; voice: Voice; persona: Persona };
const ADD_ERROR = "플레이어에 추가하지 못했어요";
/** 듣던 자리는 이만큼 움직일 때마다 저장한다(멈출 때는 바로) */
const SAVE_EVERY_MS = 3000;

const PlayerContext = createContext<PlayerApi | null>(null);
/** 플레이리스트는 직접 고른 소식이라 읽은 소식 건너뛰기를 하지 않는다 */
const NO_READ: ReadonlySet<number> = new Set();

export function PlayerProvider({ profile, children }: { profile: ProfileView; children: React.ReactNode }) {
  const { data, read, listened, markListened } = useToday();
  const toast = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  /** 메타데이터가 오기 전에 요청된 이동(항목 번호). loadedmetadata에서 그때의 챕터 표로 적용한다 */
  const pendingRef = useRef<{ index: number; play: boolean; offsetMs?: number } | null>(null);
  /** 음성을 만들며 연 파일이면, 다 받은 뒤 실제 길이로 챕터 표를 다시 받는다(ids: 그 파일을 만든 오늘 소식) */
  const refreshRef = useRef<{ persona: Persona; voice: Voice; ids: number[] | null } | null>(null);
  const loadSeq = useRef(0);
  /** 파일을 걸 때마다 늘린다(늦게 온 응답이 지금 걸린 파일 것인지 본다) */
  const fileRef = useRef(0);
  /** playOne으로 시작한 항목. 이 항목이 끝나면 자동 재생 설정과 관계없이 멈춘다 */
  const onceRef = useRef<number | null>(null);
  /** 첫 소식만 먼저 듣는 중(이벤트 처리용. 화면은 lead 상태를 본다) */
  const leadRef = useRef<Lead | null>(null);

  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  /** 에피소드 정보를 받기 전에 재생을 눌렀다(받는 대로 시작한다). 화면을 연 직후 몇 초 동안 재생 버튼이 막혀 있지 않게(2026-10-22) */
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  /** 받는 대로 시작할 때 쓸 최신 값(읽은 소식·건너뛰기·이어 듣던 자리) */
  const startFromRef = useRef<{ read: ReadonlySet<number>; skip: boolean; resumeRaw: string | null }>({ read: new Set(), skip: false, resumeRaw: null });
  const want = (on: boolean) => {
    startingRef.current = on;
    setStarting(on);
  };
  const [status, setStatus] = useState<Status>("idle");
  const [cur, setCur] = useState(-1);
  const [posMs, setPosMs] = useState(0);
  const [persona, setPersonaState] = useState(profile.persona);
  const [voice, setVoiceState] = useState(profile.voice);
  const [autoNext, setAutoNextState] = useState(profile.autoNext);
  const [skipRead, setSkipReadState] = useState(profile.skipRead);
  const [rate, setRate] = useState(() => initialRate(profile.playbackRate));
  const [lead, setLeadState] = useState<Lead | null>(null);
  /** 듣기를 시작할 때 읽은 소식(읽은 소식 건너뛰기는 듣는 동안 이 기준으로) */
  const [readSnap, setReadSnap] = useState<ReadonlySet<number> | null>(null);
  const [playlist, setPlaylist] = useState<number[] | null>(null);
  /** 지금 듣는 플레이리스트 묶음(비동기 콜백에서 읽는다) */
  const playlistRef = useRef<number[] | null>(null);
  /** 이 묶음 다음에 이어 들을 소식(PLAYLIST_MAX개씩 나눠 튼다) */
  const queueRef = useRef<number[]>([]);
  /** 플레이어에 추가했지만 음성을 만드는 중이라 아직 목록에 붙지 않은 소식 */
  const addingRef = useRef<{ clusterId: number; title: string }[]>([]);
  const [pending, setPending] = useState<{ clusterId: number; title: string }[]>([]);
  /** 다음 묶음 음성을 미리 만들어 달라고 한 주소(묶음마다 한 번) */
  const warmedRef = useRef<string | null>(null);
  /** 첫 소식을 먼저 듣는 동안 나머지 음성을 만들어 달라고 한 오늘 파일 주소(주소마다 한 번) */
  const fullWarmRef = useRef<string | null>(null);
  /** 이번에 '들음'으로 기록한 소식(같은 소식을 여러 번 보내지 않게) */
  const heardRef = useRef(new Set<number>());
  /** 마지막으로 저장한 듣던 자리 */
  const savedRef = useRef<{ clusterId: number; offsetMs: number } | null>(null);
  /** 듣는 동안 피드가 바뀌어 다시 받아야 하는지(듣기가 끝나거나 쉬면 받는다) */
  const staleRef = useRef(false);
  const busyRef = useRef(false);
  /** 재생 위치를 옮긴 횟수. 안드로이드 알림의 재생 위치를 맞출 때만 쓴다 */
  const [seeks, setSeeks] = useState(0);
  /** 이 기기에 남긴 듣던 자리(lib/player/resume.ts) */
  const resumeRaw = useResumeRaw();
  /** 오늘 플레이어 목록에서 뺀 소식(lib/player/removed.ts) */
  const removedRaw = useRemovedRaw();
  const removed = useMemo(() => parseRemoved(removedRaw, data.date), [removedRaw, data.date]);

  // 듣는 중(멈춤·음성 기다림 포함)에는 듣기 시작할 때의 읽음 기준으로 건너뛴다. 플레이리스트는 건너뛰지 않는다
  const idle = (status === "idle" || status === "done") && !preparing;
  const readSet = playlist ? NO_READ : (!idle && readSnap) || read;
  const skip = playlist ? false : skipRead;

  const enabled = profile.audio && (playlist !== null || data.items.length > 0);
  const baseChapters = episode?.chapters ?? [];
  // 첫 소식을 먼저 듣는 중이면 그 챕터의 줄 시각을 실제 값으로(대본 하이라이트·진행 막대가 맞게)
  const chapters = lead?.chapter && !episode?.ready ? withRealChapter(baseChapters, lead.index, lead.chapter) : baseChapters;
  const contentKey = data.items.map((i) => `${i.clusterId}:${i.why}`).join("|");
  // 오늘 에피소드를 만드는 목록(화면의 오늘 소식에서 뺀 소식을 뺀 것)이 바뀌었는지 보는 값
  const listKey = `${contentKey}#${[...removed].join(",")}`;
  const listKeyRef = useRef(listKey);
  /** 지금 에피소드를 받은 목록(listKey). 같으면 다시 받지 않는다(듣는 중에 빼서 이미 갈아 끼운 경우) */
  const loadedKeyRef = useRef<string | null>(null);

  /** 화면에 보이는 오늘 소식. 오늘 에피소드도 이 소식들로만 만든다(화면 목록·재생 목록·길이가 같은 소식을 가리키게) */
  const todayIdsRef = useRef<number[]>([]);
  /**
   * 지금 오늘 에피소드를 받을 때(load)의 소식. 듣는 중에 빼고 되돌리는 건 이 안에서만 한다(planTodaySwap):
   * 듣는 동안 피드에 새로 온 소식은 음성이 없어서, 넣으면 듣던 소리가 멈추고 음성을 새로 만든다
   */
  const baseIdsRef = useRef<number[]>([]);

  /** 에피소드 정보. 오늘이면 ids(기본은 화면에 보이는 오늘 소식)로, 플레이리스트면 듣는 묶음으로 */
  const fetchEpisode = useCallback(async (p: Persona, v: Voice, ids?: number[]): Promise<EpisodeData> => {
    const list = playlistRef.current;
    const today = `/api/episode/today?persona=${p}&voice=${v}&ids=${(ids ?? todayIdsRef.current).join(",")}`;
    const res = await fetch(withBase(list ? `/api/episode/playlist?${playlistQuery(list, v)}` : today), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, []);

  const setLead = useCallback((l: Lead | null) => {
    leadRef.current = l;
    setLeadState(l);
  }, []);

  /**
   * 음성을 만드는 동안 트는 안내(public/voice-samples/wait-*.mp3, 2026-10-25 사용자 결정). 본 소리와 다른 <audio>라 탭 안에서 같이 play를 건다.
   * 소리가 나오면(preparing이 풀리면)·멈춤·취소·실패 때 끈다
   */
  const waitRef = useRef<HTMLAudioElement>(null);
  /** 안내가 끝났을 때 본 소리를 다시 걸지(iOS가 두 소리를 같이 못 틀어 본 소리를 멈췄을 때 대비). 멈춤·취소·실패면 끈다 */
  const resumeAfterWaitRef = useRef(false);
  const waitTimerRef = useRef<number | undefined>(undefined);
  /**
   * 탭 안에서 소리 없이 걸어 두고(iOS는 탭 밖에서 처음 트는 소리를 막는다), WAIT_DELAY_MS 뒤에도 음성을 기다리는 중이면 처음부터 소리를 켠다.
   * 이미 만든 음성이면 그 사이에 열려서 안내가 들리지 않는다(첫 소식 음성은 있고 나머지만 없을 때 '에이…'만 들리고 끊기지 않게)
   */
  const startWait = useCallback(() => {
    const w = waitRef.current;
    if (!w) return;
    resumeAfterWaitRef.current = true;
    window.clearTimeout(waitTimerRef.current);
    w.muted = true;
    w.currentTime = 0;
    w.play().catch(() => {});
    waitTimerRef.current = window.setTimeout(() => {
      if (!resumeAfterWaitRef.current) return;
      w.currentTime = 0;
      w.muted = false;
    }, WAIT_DELAY_MS);
  }, []);
  const stopWait = useCallback(() => {
    resumeAfterWaitRef.current = false;
    window.clearTimeout(waitTimerRef.current);
    const w = waitRef.current;
    if (w && !w.paused) w.pause();
  }, []);
  /** 안내를 끝낸다(다 들었거나 음성이 다 됨). 사용자가 멈추지 않았는데 본 소리가 멈춰 있으면 다시 건다 */
  const endWait = useCallback(() => {
    const again = resumeAfterWaitRef.current;
    stopWait();
    const audio = audioRef.current;
    if (again && audio?.paused && audio.getAttribute("src")) audio.play().catch(() => {});
  }, [stopWait]);

  /** 파일을 걸고 재생을 건다. 음성이 아직 없으면 이 요청에서 서버가 만든다 */
  const openFile = useCallback(
    (ep: Pick<EpisodeData, "audioUrl" | "ready" | "persona" | "voice"> & { chapters?: Chapter[] }, index: number, play: boolean, offsetMs = 0) => {
      const audio = audioRef.current;
      if (!audio) return;
      setLead(null);
      fileRef.current++;
      pendingRef.current = index >= 0 ? { index, play, offsetMs } : null;
      refreshRef.current = ep.ready ? null : { persona: ep.persona, voice: ep.voice, ids: ep.chapters?.map((c) => c.clusterId) ?? null };
      setPreparing(!ep.ready);
      audio.muted = false;
      audio.src = ep.audioUrl;
      audio.load();
      // 바로 play()를 불러 둔다(탭 안이면 iOS 자동 재생 정책, 화면을 끈 채 이어 갈 때는 재생 중 상태를 놓지 않게).
      // 음성을 만드는 동안 기다렸다가 시작되고, 위치는 loadedmetadata에서 소리가 나기 전에 옮긴다
      if (play) audio.play().catch(() => {});
      if (play && !ep.ready) startWait();
    },
    [setLead, startWait],
  );

  /**
   * 첫 소식을 먼저 듣는 동안 오늘 전체 파일을 만들어 달라고 한다(파일은 받지 않는다. 서버는 다 만들면 저장소 주소로 넘기기만 한다).
   * 다 되면 실제 길이의 챕터 표로 바꿔 둔다. 첫 소식이 끝날 때 이 파일로 바로 이어진다
   */
  const warmFull = useCallback(
    (ep: EpisodeData) => {
      if (ep.ready || fullWarmRef.current === ep.audioUrl) return;
      fullWarmRef.current = ep.audioUrl;
      const seq = loadSeq.current;
      const ids = ep.chapters.map((c) => c.clusterId);
      fetch(ep.audioUrl, { redirect: "manual", cache: "no-store" })
        .then((res) => {
          if (res.type !== "opaqueredirect" && !res.ok) throw new Error(String(res.status));
          return fetchEpisode(ep.persona, ep.voice, ids);
        })
        .then((full) => {
          // 그사이 목록·목소리를 바꿨으면 버린다
          if (seq !== loadSeq.current || !full.ready || full.audioUrl !== ep.audioUrl) return;
          setEpisode(full);
        })
        .catch(() => {
          // 첫 소식이 끝날 때 전체 파일을 걸어 기다린다(그때 서버가 다시 만든다)
          if (fullWarmRef.current === ep.audioUrl) fullWarmRef.current = null;
        });
    },
    [fetchEpisode],
  );

  /**
   * 오늘 전체 음성이 아직 없을 때: 이 소식 하나짜리 파일을 걸어 먼저 듣는다(그 소식 음성만 만들면 바로 나온다).
   * 탭 안에서 불러야 한다(iOS). warm이면 그동안 서버가 나머지 소식도 만들게 한다(같은 음성은 서버가 한 번만 만든다)
   */
  const startLead = useCallback(
    (ep: EpisodeData, index: number, offsetMs: number, warm: boolean) => {
      const audio = audioRef.current;
      const ch = ep.chapters[index];
      if (!audio || !ch) return;
      const query = itemQuery(ch.clusterId, ep.persona, ep.voice);
      fileRef.current++;
      pendingRef.current = null;
      refreshRef.current = null;
      setLead({ index, clusterId: ch.clusterId, query, offsetMs, chapter: null });
      setPreparing(true);
      setPosMs(ch.startMs + offsetMs);
      audio.muted = false;
      audio.src = itemAudioUrl(query);
      audio.load();
      audio.play().catch(() => {});
      startWait();
      if (warm) warmFull(ep);
    },
    [setLead, startWait, warmFull],
  );

  const load = useCallback(
    async (p: Persona, v: Voice, keep: { index: number; resume: boolean; clusterId?: number }) => {
      const seq = ++loadSeq.current;
      // 지금 화면의 오늘 소식으로 받으니 미뤄 둔 새로 받기는 필요 없다
      staleRef.current = false;
      loadedKeyRef.current = listKeyRef.current;
      try {
        const ep = await fetchEpisode(p, v);
        const audio = audioRef.current;
        if (seq !== loadSeq.current || !audio) return;
        setError(null);
        setPreparing(false);
        setEpisode(ep);
        if (!playlistRef.current) baseIdsRef.current = ep.chapters.map((c) => c.clusterId);
        // 받기 전에 재생을 눌렀으면 받는 대로 시작한다: 이어 듣던 자리, 아니면 처음 들을 소식부터(play와 같은 자리)
        let offsetMs = 0;
        if (startingRef.current) {
          startingRef.current = false;
          setStarting(false);
          if (!keep.resume && !playlistRef.current && ep.chapters.length) {
            const { read, skip, resumeRaw } = startFromRef.current;
            const at = resumeTarget(ep.chapters, parseResume(resumeRaw, ep.date), read, skip);
            keep = { index: at?.index ?? startIndex(ep.chapters, read, skip), resume: true };
            offsetMs = at?.offsetMs ?? 0;
            onceRef.current = null;
            setReadSnap(new Set(read));
            track("listen_start", { mode: "today" });
          }
        }
        // 듣던 소식은 번호가 아니라 소식으로 찾는다(목록이 늘어 번호가 밀렸어도 같은 소식)
        const kept = keep.clusterId === undefined ? -1 : ep.chapters.findIndex((c) => c.clusterId === keep.clusterId);
        const index = kept >= 0 ? kept : Math.min(keep.index, ep.chapters.length - 1);
        if (index < 0) {
          setStatus("idle");
          setCur(-1);
          setPosMs(0);
        } else setCur(index);
        // 듣던 중이고 오늘 전체 음성이 아직 없으면 그 소식부터 먼저 듣는다
        if (keep.resume && index >= 0 && !ep.ready && !playlistRef.current) return startLead(ep, index, offsetMs, true);
        if (ep.ready || keep.resume) {
          openFile(ep, index, keep.resume, offsetMs);
        } else {
          // 아직 음성이 없다. 재생을 누를 때 만든다(지금 만들면 듣지 않을 음성에 비용이 든다)
          setLead(null);
          pendingRef.current = null;
          refreshRef.current = null;
          audio.removeAttribute("src");
          audio.load();
        }
      } catch {
        if (seq !== loadSeq.current) return;
        setError(LOAD_ERROR);
        // 받기 전에 누른 재생은 그만둔다(실패 문구와 '다시 시도'가 보인다)
        startingRef.current = false;
        setStarting(false);
      }
    },
    [fetchEpisode, openFile, setLead, startLead],
  );

  // 말투·목소리의 최신 값. 피드 내용이 바뀌어 다시 불러올 때만 읽는다.
  const prefsRef = useRef({ persona, voice });
  useEffect(() => {
    prefsRef.current = { persona, voice };
    startFromRef.current = { read, skip: skipRead, resumeRaw };
    todayIdsRef.current = keptIds(data.items.map((i) => i.clusterId), removed);
    listKeyRef.current = listKey;
    busyRef.current = !idle;
  });

  // 처음 들어왔을 때, 그리고 피드 내용(why 문구 등)이 바뀌었을 때 에피소드를 새로 받는다.
  // 재생 버튼을 누르는 순간 바로 play()를 부를 수 있게 미리 받아 둔다(iOS는 탭 안에서 play해야 한다).
  // 듣는 중(멈춤·음성 기다림 포함)이면 끊지 않고 미뤄 둔다(하나 더 받기 등으로 목록이 바뀌어도 듣던 소리·자리가 그대로이게).
  // 화면을 끈 채 파일을 바꿔 끼우면 iOS가 소리를 놓칠 수 있어서, 듣던 파일은 끝까지 그대로 둔다
  useEffect(() => {
    const audio = audioRef.current;
    // 플레이리스트를 듣는 동안은 오늘 피드가 바뀌어도 그대로 둔다(돌아올 때 exitPlaylist가 다시 받는다)
    if (playlistRef.current) return;
    if (!enabled) {
      loadSeq.current++;
      loadedKeyRef.current = null;
      audio?.pause();
      return;
    }
    if (loadedKeyRef.current === listKey) return;
    if (busyRef.current) {
      staleRef.current = true;
      return;
    }
    void load(prefsRef.current.persona, prefsRef.current.voice, { index: -1, resume: false });
  }, [enabled, listKey, load]);

  // 음성이 다 되면(파일이 열리면) 안내를 끈다
  useEffect(() => {
    if (!preparing) endWait();
  }, [preparing, endWait]);

  // 미뤄 둔 새 목록은 다 듣거나 쉬게 되면 받는다
  useEffect(() => {
    if (!idle || !staleRef.current || playlistRef.current || !enabled) return;
    void load(prefsRef.current.persona, prefsRef.current.voice, { index: -1, resume: false });
  }, [idle, enabled, load]);

  /** 오늘(또는 플레이리스트) 전체 파일이 안 걸려 있으면(만들기 전·첫 소식만 먼저 듣는 중·실패나 취소 뒤) 재생을 누를 때 건다 */
  const needsFile = () => !!episode && audioRef.current?.getAttribute("src") !== episode.audioUrl;
  /** 전체 파일이 걸려 있고 열렸는지(음성을 기다리는 중이 아님) */
  const fileOpen = () => !needsFile() && (audioRef.current?.readyState ?? 0) >= 1;

  const startPlayback = () => {
    audioRef.current?.play().catch(() => setError(PLAY_ERROR));
  };

  /** 쉬다가 새로 듣기 시작할 때: 읽은 소식 건너뛰기는 지금 읽은 소식 기준으로 고정한다 */
  const begin = () => {
    if (status === "idle" || status === "done") setReadSnap(new Set(read));
  };

  const enter = (index: number) => {
    setCur(index);
    if (index === chapters.length - 1) warmNextBatch();
  };

  /** 실제로 소리가 난 소식을 '들음'으로 기록한다(음성을 못 만들었으면 기록하지 않게, 재생이 시작된 뒤에만) */
  const heard = (id: number) => {
    if (heardRef.current.has(id)) return;
    heardRef.current.add(id);
    if (!listened.has(id)) markListened(id);
  };

  /** 오늘 듣던 자리를 이 기기에 남긴다(같은 날 다시 열면 여기서 이어 듣는다) */
  const remember = (clusterId: number, offsetMs: number, now = false) => {
    if (playlistRef.current || !episode) return;
    const last = savedRef.current;
    if (!now && last && last.clusterId === clusterId && Math.abs(last.offsetMs - offsetMs) < SAVE_EVERY_MS) return;
    savedRef.current = { clusterId, offsetMs };
    saveResume({ date: episode.date, mode: "today", clusterId, offsetMs: Math.round(offsetMs) });
  };

  /** 다 들었을 때 */
  const finish = (complete: boolean) => {
    if (complete) track("listen_complete", { mode: playlistRef.current ? "playlist" : "today" });
    setStatus("done");
    setCur(-1);
    if (!playlistRef.current) {
      savedRef.current = null;
      clearResume();
    }
  };

  /**
   * 플레이리스트 묶음의 마지막 소식에 들어서면 다음 묶음 음성을 미리 만들어 둔다. 화면을 끈 채 묶음이 바뀔 때
   * 서버가 음성을 만드는 동안 소리가 끊기면 iOS가 앱을 재울 수 있어서, 넘어가는 순간엔 파일이 바로 오게 한다.
   * 파일은 받지 않는다(서버는 다 만들면 저장소 주소로 넘기기만 한다)
   */
  const warmNextBatch = () => {
    const next = queueRef.current.slice(0, PLAYLIST_MAX);
    if (!playlistRef.current || !next.length) return;
    const url = playlistAudioUrl(next, voice);
    if (warmedRef.current === url) return;
    warmedRef.current = url;
    fetch(url, { redirect: "manual", cache: "no-store" }).catch(() => {});
  };

  /** 먼저 듣는 첫 소식 파일 안에서 옮긴다. 파일이 아직 안 열렸으면 열릴 때(onLoadedMetadata) 옮겨 갈 자리로 남긴다 */
  const moveInLead = (offsetMs: number) => {
    const audio = audioRef.current;
    const l = leadRef.current;
    const ch = l && chapters[l.index];
    if (!audio || !l || !ch) return;
    if (audio.readyState >= 1) audio.currentTime = offsetMs / 1000;
    else setLead({ ...l, offsetMs });
    setPosMs(ch.startMs + offsetMs);
  };

  const goTo = (index: number, { offsetMs = 0, once = false }: { offsetMs?: number; once?: boolean } = {}) => {
    const ch = chapters[index];
    const audio = audioRef.current;
    if (!ch || !audio || !episode) return;
    onceRef.current = once ? index : null;
    setError(null);
    begin();
    enter(index);
    const l = leadRef.current;
    if (l && l.index === index) {
      // 먼저 듣는 첫 소식 안에서 옮길 때는 파일을 다시 걸지 않는다(아직 받는 중이면 파일이 열릴 때 그 자리로 간다)
      moveInLead(offsetMs);
      if (audio.paused) startPlayback();
      return;
    }
    // 오늘 전체 음성이 아직 없으면 이 소식 하나만 먼저 만들어 바로 듣는다(이 소식 하나만 들을 때는 나머지를 만들지 않는다)
    if (!episode.ready && !playlistRef.current && !fileOpen()) return startLead(episode, index, offsetMs, !once);
    if (needsFile()) return openFile(episode, index, true, offsetMs);
    if (preparing || audio.readyState < 1) {
      // 음성을 만드는 중이면 다 받은 뒤 이 항목으로 간다
      pendingRef.current = { index, play: true, offsetMs };
      return;
    }
    // 실제 시각표를 기다리던 예전 이동이 있으면 버린다(늦게 와서 이 자리를 덮지 않게)
    pendingRef.current = null;
    const ms = ch.startMs + offsetMs;
    audio.currentTime = ms / 1000;
    setPosMs(ms);
    if (audio.paused) startPlayback();
  };

  /**
   * 소식을 고른다(이전·다음·재생 목록). 듣는 중이면 그 소식을 이어서 듣고, 멈췄거나 쉬는 중이면 자리만 옮긴다(소리는 재생 버튼으로).
   * 파일을 아직 안 걸었으면 걸지 않는다(음성은 재생을 누를 때 만든다)
   */
  const select = (index: number, offsetMs = 0) => {
    const ch = chapters[index];
    const audio = audioRef.current;
    if (!ch || !audio || !episode) return;
    if (status === "playing") return goTo(index, { offsetMs });
    setError(null);
    onceRef.current = null;
    const ms = ch.startMs + offsetMs;
    const l = leadRef.current;
    if (l) {
      // 첫 소식을 먼저 듣다 멈춘 중: 그 소식이면 그 파일 안에서 옮겨 둔다(재생을 누르면 여기서).
      // 다른 소식이면 자리만 옮겨 둔다. 그 소식은 전체 파일에 있어서 재생을 누르면 play가 그 소식부터 튼다(needsFile)
      if (l.index === index) moveInLead(offsetMs);
    }
    // 음성을 기다리는 중이면 다 받은 뒤 이 자리로만 옮긴다(재생은 하지 않는다)
    else if (pendingRef.current) pendingRef.current = { index, play: false, offsetMs };
    else if (fileOpen() && !preparing) audio.currentTime = ms / 1000;
    // 다 들은 뒤 고르면 그 소식에 멈춰 둔다(재생을 누르면 처음부터가 아니라 여기서)
    if (status === "done") setStatus("paused");
    enter(index);
    setPosMs(ms);
  };

  const playOne = (index: number) => {
    // 이 소식을 듣다 멈춘 거면 멈춘 자리부터 이어서 튼다(처음으로 돌아가지 않게).
    // 전체 듣기 중에 멈췄다면 이어서 튼 뒤에도 다음 소식으로 계속 간다
    const ch = chapters[index];
    const here = cur === index && status === "paused" && !!ch && posMs >= ch.startMs && posMs < ch.endMs;
    const loaded = leadRef.current ? leadRef.current.index === index : !needsFile();
    if (here && loaded && !preparing) {
      setError(null);
      startPlayback();
      return;
    }
    // 파일을 다시 걸어야 하면(실패·취소한 뒤) 멈춘 자리부터
    goTo(index, { once: true, offsetMs: here ? posMs - ch.startMs : 0 });
    track("listen_start", { mode: "today_one" });
  };

  /** 듣던 자리를 이어 들을 수 있으면 그 항목과 자리(오늘, 같은 날, 쉬는 중일 때만) */
  const resumeAt =
    !playlist && episode && status === "idle" && cur < 0 ? resumeTarget(chapters, parseResume(resumeRaw, episode.date), readSet, skip) : null;

  const play = () => {
    if (!episode) {
      // 아직 받는 중이면 받는 대로 시작한다(받기에 실패했으면 다시 받고 시작). 앱(웹뷰)은 탭 밖의 재생을 막지 않는다.
      // 브라우저가 막으면 소리가 안 나고, 한 번 더 누르면 그때는 바로 시작된다
      if (!enabled) return;
      want(true);
      if (error) {
        setError(null);
        void load(persona, voice, { index: -1, resume: false });
      }
      return;
    }
    if (!chapters.length) return;
    if (status === "idle" || status === "done") track("listen_start", { mode: playlistRef.current ? "playlist" : "today" });
    // 음성을 기다리는 중에 멈췄다가 다시 누르면 다 되는 대로 시작한다
    if (pendingRef.current) pendingRef.current.play = true;
    onceRef.current = null;
    const l = leadRef.current;
    if (l && cur === l.index && status !== "done") {
      setError(null);
      startPlayback();
      return;
    }
    if (status === "done" || cur < 0) {
      goTo(resumeAt?.index ?? startIndex(chapters, readSet, skip), { offsetMs: resumeAt?.offsetMs });
      return;
    }
    if (needsFile()) {
      // 파일을 다시 걸어야 하면(실패·취소한 뒤, 첫 소식을 다 듣고 멈춘 뒤) 멈춘 자리부터
      const ch = chapters[cur];
      goTo(cur, { offsetMs: ch ? Math.min(Math.max(0, posMs - ch.startMs), Math.max(0, ch.endMs - ch.startMs - 1000)) : 0 });
      return;
    }
    // 쉬는 중에 소식을 골라 둔 뒤 누른 경우도 여기로 온다(읽은 소식 건너뛰기 기준을 이때 고정)
    begin();
    enter(cur);
    startPlayback();
  };

  const pause = () => {
    want(false);
    stopWait();
    // 음성을 만드는 중에 멈추면 다 만들어져도 저절로 시작하지 않는다(잠금 화면·알림 버튼도 여기로 온다)
    if (pendingRef.current) pendingRef.current.play = false;
    audioRef.current?.pause();
  };

  const cancel = () => {
    const audio = audioRef.current;
    if (!audio) return;
    stopWait();
    pendingRef.current = null;
    refreshRef.current = null;
    setLead(null);
    setPreparing(false);
    audio.pause();
    audio.muted = false;
    // 기다리던 파일을 떼어 낸다(서버는 하던 음성을 마저 만들어 두어 다음에 누르면 바로 나온다)
    if (audio.getAttribute("src")) {
      audio.removeAttribute("src");
      audio.load();
    }
    // 아직 한 마디도 못 들었으면 처음 상태로, 듣던 중이었으면 그 자리에 멈춰 둔다
    const ch = chapters[cur];
    if (!ch || posMs <= ch.startMs) {
      setStatus("idle");
      setCur(-1);
      setPosMs(0);
    } else setStatus("paused");
  };

  const retry = () => {
    setError(null);
    if (!episode) {
      // 다시 받는 대로 시작한다
      want(true);
      return void load(persona, voice, { index: cur, resume: false });
    }
    play();
  };

  /** 에피소드 시각 ms로 옮긴다. 다른 소식으로 넘어가면 그 소식에 들어선다(자동 재생·건너뛰기 판단 없이 고른 자리로) */
  const moveTo = (ms: number, andPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio || !episode || cur < 0 || status === "done") return;
    const index = Math.min(chapterAt(chapters, ms), chapters.length - 1);
    const ch = chapters[index];
    if (!ch) return;
    setError(null);
    const l = leadRef.current;
    if (l) {
      // 첫 소식을 먼저 듣는 중: 그 소식 안이면 파일 안 시각으로, 다른 소식이면 그 소식으로 간다.
      // 멈춰 있는데 바로 듣지 않을 때는 자리만 옮겨 둔다(재생을 누르면 play가 그 자리부터 튼다)
      if (index !== l.index) {
        if (andPlay || status === "playing") return goTo(index, { offsetMs: Math.max(0, ms - ch.startMs) });
        setPosMs(ms);
        setCur(index);
        return;
      }
      // 다른 소식에 자리만 옮겨 두었다가 돌아온 경우도 있다(그 소식에 다시 들어선다)
      moveInLead(Math.max(0, ms - ch.startMs));
      if (index !== cur) setCur(index);
      if (andPlay && audio.paused) startPlayback();
      return;
    }
    if (needsFile() && !preparing) {
      // 파일이 없으면(실패·취소한 뒤, 첫 소식을 다 듣고 멈춘 뒤) 바로 들을 때는 그 자리로 가고, 아니면 멈춘 자리만 옮겨 둔다(재생을 누르면 여기서)
      if (andPlay) return goTo(index, { offsetMs: Math.max(0, ms - ch.startMs) });
      setPosMs(ms);
      setCur(index);
      return;
    }
    if (needsFile() || preparing || audio.readyState < 1) return;
    pendingRef.current = null;
    audio.muted = false;
    audio.currentTime = ms / 1000;
    setPosMs(ms);
    if (index !== cur) enter(index);
    if (andPlay && audio.paused) startPlayback();
  };

  const seek = (ms: number) => moveTo(ms, true);
  const seekTo = (ms: number) => moveTo(ms, false);
  const skipBy = (deltaMs: number) => {
    const end = chapters.at(-1)?.endMs ?? 0;
    moveTo(Math.min(Math.max(0, posMs + deltaMs), Math.max(0, end - 500)), false);
  };
  const seekProgress = (elapsedMs: number) => {
    const at = positionAt(chapters, elapsedMs, readSet, skip);
    if (at) moveTo(at.ms, false);
  };

  // 고른 소식이 없으면(쉬는 중) 재생을 누르면 나올 소식을 기준으로 앞뒤를 고른다
  const base = cur >= 0 ? cur : (resumeAt?.index ?? startIndex(chapters, readSet, skip));
  const nextIndex = nextPlayable(chapters, base + 1, readSet, skip);
  const prevIndex = chapters.length ? prevPlayable(chapters, base - 1, readSet, skip) : null;
  const next = () => {
    if (nextIndex !== null) select(nextIndex);
  };

  const prev = () => {
    // 3초 넘게 들었으면 이 항목 처음으로, 아니면 앞 항목으로
    if (cur >= 0 && posMs - chapters[cur]!.startMs > 3000) return select(cur);
    if (prevIndex !== null) select(prevIndex);
  };

  const restart = () => goTo(startIndex(chapters, readSet, skip));

  const setPersona = (p: Persona) => {
    if (p === persona) return;
    setPersonaState(p);
    void savePlayerPrefs({ persona: p });
    void load(p, voice, { index: cur, resume: status === "playing", clusterId: chapters[cur]?.clusterId });
  };

  const setVoice = (v: Voice) => {
    if (v === voice) return;
    track("voice_change", { voice: v });
    setVoiceState(v);
    void savePlayerPrefs({ voice: v });
    if (persona !== "dialogue") void load(persona, v, { index: cur, resume: status === "playing", clusterId: chapters[cur]?.clusterId });
  };

  const setAutoNext = (on: boolean) => {
    setAutoNextState(on);
    void savePlayerPrefs({ autoNext: on });
  };

  const setSkipRead = (on: boolean) => {
    setSkipReadState(on);
    void savePlayerPrefs({ skipRead: on });
  };

  const playPlaylist = (ids: number[], { continued = false }: { continued?: boolean } = {}) => {
    const audio = audioRef.current;
    const list = ids.slice(0, PLAYLIST_MAX);
    if (!audio || !profile.audio || !list.length) return;
    queueRef.current = ids.slice(PLAYLIST_MAX);
    if (!continued) {
      track("listen_start", { mode: "playlist", count: ids.length });
      addingRef.current = [];
      setPending([]);
    }
    playlistRef.current = list;
    setPlaylist(list);
    const seq = ++loadSeq.current;
    onceRef.current = null;
    setError(null);
    setEpisode(null);
    // 다음 묶음으로 이어 갈 때는 '재생 중'을 그대로 둔다. 잠깐이라도 쉬는 상태가 되면 잠금 화면 조작과
    // 안드로이드 포그라운드 서비스가 내려가는데, 화면을 끈 채로는 서비스를 다시 띄울 수 없다(안드로이드 12+)
    if (!continued) setStatus("idle");
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

  /** 묶음이 끝났을 때 이어 들을 소식이 남았으면 다음 묶음을 튼다 */
  const continueQueue = (): boolean => {
    if (!playlistRef.current || !queueRef.current.length) return false;
    playPlaylist(queueRef.current, { continued: true });
    return true;
  };

  const exitPlaylist = () => {
    queueRef.current = [];
    addingRef.current = [];
    setPending([]);
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

  const playToday = () => {
    // 오늘 소식을 이미 플레이어에 올려 둔 상태면 이어서(멈췄던 자리·처음부터)
    if (!playlistRef.current) return status === "playing" ? undefined : play();
    queueRef.current = [];
    addingRef.current = [];
    setPending([]);
    playlistRef.current = null;
    setPlaylist(null);
    onceRef.current = null;
    setEpisode(null);
    setPreparing(false);
    setError(null);
    setStatus("idle");
    setCur(-1);
    setPosMs(0);
    setReadSnap(new Set(read));
    track("listen_start", { mode: "today" });
    void load(persona, voice, { index: 0, resume: true });
  };

  /**
   * 듣는 중에 플레이어 목록을 ids로 갈아 끼운다(순서 바꾸기·빼기·되돌리기·추가가 끝난 뒤). 음성 조각이 다 있는 목록만 넘긴다(이어 붙이기만 하면 된다).
   * 플레이리스트를 듣는 중이면 그 묶음을, 아니면 오늘 목록을 바꾼다. 듣던 소식이 남아 있으면 그 소식의 듣던 자리에서,
   * 뺐으면 그 자리에 온 소식 처음부터 이어 간다. 다 뺐으면 플레이리스트는 닫고, 오늘은 멈추고 다시 받는다
   */
  const swap = (ids: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const list = playlistRef.current;
    if (!ids.length) {
      if (list) return exitPlaylist();
      todayIdsRef.current = ids;
      audio.pause();
      setStatus("idle");
      setCur(-1);
      setPosMs(0);
      void load(persona, voice, { index: -1, resume: false });
      return;
    }
    if (list) {
      playlistRef.current = ids;
      setPlaylist(ids);
    }
    const seq = ++loadSeq.current;
    fetchEpisode(persona, voice, list ? undefined : ids)
      .then((ep) => {
        if (seq !== loadSeq.current) return;
        // 받는 동안에도 듣던 소리는 이어지므로 듣던 소식·자리·재생 여부는 지금 값으로 본다(그사이 다음 소식으로 넘어갔거나 멈췄을 수 있다).
        // 파일은 아직 예전 것이라 예전 챕터 표로 본다. 옮길 자리가 걸려 있으면 그 자리, 파일을 떼어 냈으면(취소·오류 뒤) 화면의 자리로
        const pending = pendingRef.current;
        const fileMs = fileOpen() ? audio.currentTime * 1000 : null;
        const at = pending ? pending.index : fileMs !== null && chapters.length ? Math.min(chapterAt(chapters, fileMs), chapters.length - 1) : cur;
        const curId = chapters[at]?.clusterId;
        const offsetMs = heldOffset(chapters, at, { pending, fileMs, posMs });
        const fallback = curId !== undefined && !ids.includes(curId) ? Math.min(at, ids.length - 1) : -1;
        const resume = !audio.paused;
        setEpisode(ep);
        const kept = curId === undefined ? -1 : ep.chapters.findIndex((c) => c.clusterId === curId);
        const index = kept >= 0 ? kept : fallback;
        // 아직 듣기 전이면 파일은 재생을 누를 때 건다(needsFile)
        if (index < 0) return setCur(-1);
        setCur(index);
        const ch = ep.chapters[index]!;
        openFile(ep, index, resume, kept >= 0 ? Math.min(offsetMs, Math.max(0, ch.endMs - ch.startMs - 500)) : 0);
      })
      .catch(() => {
        if (seq === loadSeq.current) setError(LOAD_ERROR);
      });
  };
  // 음성을 미리 만든 뒤(비동기) 부를 때도 그때의 최신 상태로 갈아 끼우게 ref로 둔다
  const swapRef = useRef(swap);
  useEffect(() => {
    swapRef.current = swap;
  });

  /** 음성 조각이 다 있고 만드는 중이 아닐 때만 목록을 바로 바꿀 수 있다 */
  const canEdit = !!playlist && !!episode?.ready && !preparing;
  // 오늘 목록은 듣기 전이면 언제든(다시 받기만 하면 된다), 듣는 중이면 음성 조각이 다 있을 때만(이어 붙이기만 하면 된다)
  const canRemove = playlist ? canEdit : !!episode && (idle || (!!episode.ready && !preparing && !lead));

  /**
   * 오늘 목록에서 뺀 소식을 바꾼다. 듣기 전이면 저장만 하고(목록이 바뀌어 다시 받는다), 듣는 중이면 바로 갈아 끼운다.
   * 듣는 중에는 지금 에피소드를 받을 때의 소식 안에서만 바꾼다(planTodaySwap: 음성이 없는 소식을 넣어 듣던 소리가 멈추지 않게)
   */
  const setRemovedToday = (next: ReadonlySet<number>) => {
    if (!canRemove) return;
    if (!idle) {
      const now = chapters.map((c) => c.clusterId);
      const base = baseIdsRef.current.length ? baseIdsRef.current : now;
      const plan = planTodaySwap(base, now, data.items.map((i) => i.clusterId), next);
      // 화면 목록과 같아졌으면 다시 받지 않는다. 아니면 받은 목록 표시를 그대로 두어, 목록이 바뀐 걸로 보고 듣기가 끝난 뒤 받는다(staleRef)
      if (plan.synced) loadedKeyRef.current = `${contentKey}#${[...next].join(",")}`;
      if (plan.ids) swap(plan.ids);
    }
    saveRemoved(data.date, next);
  };

  const restoreToday = () => {
    if (!playlist && removed.size) setRemovedToday(new Set());
  };

  const reorderPlaylist = (ids: number[]) => {
    const list = playlistRef.current;
    if (!list || !canEdit) return;
    if (ids.length !== list.length || ids.every((id, i) => id === list[i])) return;
    swap(ids);
  };

  const removeFromPlayer = (id: number) => {
    // 음성을 만드는 중인(추가 대기) 소식이면 대기에서만 뺀다(다 만들어져도 붙이지 않는다)
    if (addingRef.current.some((x) => x.clusterId === id)) {
      addingRef.current = addingRef.current.filter((x) => x.clusterId !== id);
      setPending(addingRef.current);
      return null;
    }
    const list = playlistRef.current;
    if (!list) {
      if (removed.has(id) || !canRemove) return null;
      setRemovedToday(new Set([...removed, id]));
      return undoOf({ id, before: null, voice, persona });
    }
    if (!canEdit || !list.includes(id)) return null;
    swap(list.filter((x) => x !== id));
    // 마지막 하나를 빼면 플레이리스트가 닫혀서 되돌리지 않는다
    return list.length > 1 ? undoOf({ id, before: list, voice, persona }) : null;
  };

  /**
   * 되돌리기 알림의 '되돌리기'. 몇 초 뒤에 눌리므로 그때의 최신 상태(ref)로 판단한다.
   * 오늘 소식은 뺀 표시만 지운다(화면 순서 자리로 돌아오고, 듣는 중이면 restoreToday와 같은 규칙으로 갈아 끼운다).
   * 플레이리스트는 뺄 때 목록(before)의 자리로 다시 끼운다. 이미 들어 있으면 그대로(겹치지 않게).
   * 뺀 직후라 음성을 다시 이어 붙이는 중이면(몇 초) 'wait': 맡아 두었다가 다 되는 대로 넣는다(deferredUndoRef).
   * 그사이 오늘 ↔ 플레이리스트로 바뀌었거나, 목소리가 바뀌었거나(뺀 소식의 음성 조각이 없을 수 있다), 목록이 다 찼으면 'fail'
   */
  const undoRef = useRef<(u: UndoArgs) => "done" | "wait" | "fail">(() => "fail");
  useEffect(() => {
    undoRef.current = ({ id, before, voice: v, persona: p }) => {
      const list = playlistRef.current;
      if ((before === null) !== (list === null)) return "fail";
      if (!list || !before) {
        if (!removed.has(id)) return "done";
        if (!canRemove) return "wait";
        setRemovedToday(new Set([...removed].filter((x) => x !== id)));
        return "done";
      }
      if (list.includes(id) || addingRef.current.some((x) => x.clusterId === id)) return "done";
      // 뺀 뒤 목록이 그대로일 때만 되돌린다(그사이 다른 플레이리스트를 틀었거나 목록을 바꿨으면 엉뚱한 목록에 넣지 않게)
      if (!sameIds(list, before.filter((x) => x !== id))) return "fail";
      if (v !== voice || p !== persona || list.length >= PLAYLIST_MAX) return "fail";
      if (!canEdit) return "wait";
      const next = reinsert(list, id, before);
      if (!next) return "fail";
      swap(next);
      return "done";
    };
  });
  /** 맡아 둔 되돌리기(음성을 이어 붙이는 동안 눌린 것). 이만큼 안에 못 넣으면 그만두고 알린다 */
  const deferredUndoRef = useRef<{ u: UndoArgs; until: number } | null>(null);
  /** 기한이 지났는지 보려고 한 번 더 그리게 하는 값(멈춘 채 아무것도 안 바뀌어도 기한에 알리게) */
  const [undoTick, setUndoTick] = useState(0);
  // 바꿀 수 있게 되면(음성이 다 돼 preparing이 풀리면) 맡아 둔 되돌리기를 넣어 본다. 기한이 지나면 그만두고 알림으로 알린다
  useEffect(() => {
    const d = deferredUndoRef.current;
    if (!d) return;
    const r = Date.now() > d.until ? "fail" : undoRef.current(d.u);
    if (r === "wait") return;
    deferredUndoRef.current = null;
    if (r === "fail") toast.showError(UNDO_ERROR);
  }, [canRemove, canEdit, undoTick, toast]);
  const undoOf = (u: UndoArgs) => () => {
    const r = undoRef.current(u);
    if (r === "wait") {
      deferredUndoRef.current = { u, until: Date.now() + UNDO_WAIT_MS };
      setTimeout(() => setUndoTick((t) => t + 1), UNDO_WAIT_MS + 100);
    }
    return r !== "fail";
  };

  const addToPlayer = (items: { clusterId: number; title: string }[]) => {
    const list = playlistRef.current;
    // 플레이리스트를 듣는 중이 아니면(오늘 소식·쉬는 중) 플레이어를 이 소식으로 채우고 바로 들려준다
    if (!list) return playPlaylist(items.map((i) => i.clusterId));
    const have = new Set([...list, ...addingRef.current.map((x) => x.clusterId)]);
    const fresh = items.filter((i) => !have.has(i.clusterId)).slice(0, Math.max(0, PLAYLIST_MAX - have.size));
    if (!fresh.length) return;
    addingRef.current = [...addingRef.current, ...fresh];
    setPending(addingRef.current);
    // 지금 듣는 파일은 그대로 두고 새 소식 음성을 미리 만든다(서버는 다 만들면 저장소 주소로 넘기기만 한다). 다 되면 목록 끝에 붙여 갈아 끼운다
    const target = [...list, ...fresh.map((f) => f.clusterId)];
    const settle = (ok: boolean) => {
      const still = addingRef.current.filter((x) => fresh.some((f) => f.clusterId === x.clusterId));
      addingRef.current = addingRef.current.filter((x) => !fresh.some((f) => f.clusterId === x.clusterId));
      setPending(addingRef.current);
      const now = playlistRef.current;
      if (!ok) return setError(ADD_ERROR);
      if (!still.length || !now) return;
      swapRef.current([...now, ...still.map((x) => x.clusterId).filter((id) => !now.includes(id))]);
    };
    fetch(playlistAudioUrl(target, voice), { redirect: "manual", cache: "no-store" })
      .then((res) => settle(res.type === "opaqueredirect" || res.ok))
      .catch(() => settle(false));
  };

  const cycleRate = () => {
    const r = nextRate(rate);
    setRate(r);
    const audio = audioRef.current;
    if (audio) {
      audio.defaultPlaybackRate = r;
      audio.playbackRate = r;
    }
    void savePlayerPrefs({ rate: r });
  };

  /** 먼저 듣던 첫 소식이 끝났을 때: 다음 소식부터는 오늘 전체 파일로 이어 간다 */
  const leadEnded = (l: Lead) => {
    setLead(null);
    const once = onceRef.current !== null;
    onceRef.current = null;
    const n = nextPlayable(chapters, l.index + 1, readSet, skip);
    if (n === null || !episode) return finish(true);
    const ch = chapters[n]!;
    if (once || !autoNext) {
      // 이 소식 하나만 들었거나 자동 재생이 꺼져 있으면 다음 소식 시작점에서 멈춘다(재생을 누르면 그때 파일을 건다)
      setCur(n);
      setPosMs(ch.startMs);
      setStatus("paused");
      return;
    }
    enter(n);
    setPosMs(ch.startMs);
    // 전체 파일이 다 됐으면 바로 이어지고, 아직이면 다 만들어질 때까지 기다렸다가 시작된다(서버는 같은 음성을 두 번 만들지 않는다)
    openFile(episode, n, true);
  };

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    // 파일을 막 바꿔 끼웠거나 옮겨 갈 자리를 기다리는 중이면(0초에서 오는 timeupdate) 위치·챕터를 건드리지 않는다
    if (audio.readyState < 1 || pendingRef.current) return;
    const sounding = !audio.paused && audio.readyState >= 3;
    const l = leadRef.current;
    if (l) {
      // 멈춘 채 다른 소식으로 자리만 옮겨 두었으면 이 파일의 시각으로 덮지 않는다(파일이 늦게 열려 오는 timeupdate)
      if (cur !== l.index) return;
      const t = audio.currentTime * 1000;
      setPosMs((chapters[l.index]?.startMs ?? 0) + t);
      if (sounding) {
        heard(l.clusterId);
        remember(l.clusterId, t);
      }
      return;
    }
    const ms = audio.currentTime * 1000;
    setPosMs(ms);
    if (audio.paused || !chapters.length) return;
    const ch = chapters[cur];
    if (sounding && ch && ms >= ch.startMs && ms < ch.endMs) {
      heard(ch.clusterId);
      remember(ch.clusterId, ms - ch.startMs);
    }
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
        if (continueQueue()) break;
        audio.pause();
        finish(true);
        break;
    }
  };

  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    setPreparing(false);
    const l = leadRef.current;
    if (l) {
      // 이어 듣기면 소리가 나기 전에 듣던 자리로
      if (l.offsetMs > 0) {
        const end = Number.isFinite(audio.duration) ? Math.max(0, audio.duration * 1000 - 1000) : Infinity;
        audio.currentTime = Math.min(l.offsetMs, end) / 1000;
      }
      // 파일이 열린 뒤에 대본 시각표를 받는다(그때는 음성이 다 만들어져 있어 실제 시각이 나온다)
      fetch(itemInfoUrl(l.query), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { chapter: Chapter } | null) => {
          const now = leadRef.current;
          if (d && now && now.query === l.query) setLead({ ...now, chapter: d.chapter });
        })
        .catch(() => {});
      return;
    }
    const refresh = refreshRef.current;
    refreshRef.current = null;
    /**
     * 기다리던 이동을 적용한다. 기다리는 동안 select·goTo가 자리를 바꿨으면 마지막 값으로(멈춤은 play를 false로 바꿔 둔다),
     * 그사이 바로 옮겼으면(moveTo·goTo가 pendingRef를 비운다) 할 일이 없다. 어느 쪽이든 비워서 timeupdate가 다시 돌게 한다
     */
    const apply = (chs: Chapter[]) => {
      audio.muted = false;
      const target = pendingRef.current;
      pendingRef.current = null;
      if (!target) return;
      const ms = (chs[target.index]?.startMs ?? 0) + (target.offsetMs ?? 0);
      audio.currentTime = ms / 1000;
      setPosMs(ms);
      if (target.play) startPlayback();
    };
    if (!refresh) return apply(chapters);
    // 첫 자리가 아닌 곳으로 옮겨 가야 하면 실제 시각표가 올 때까지 소리를 죽여 둔다(파일 맨 앞이 잠깐 들리지 않게)
    const target = pendingRef.current;
    if (target?.play && (target.index > 0 || (target.offsetMs ?? 0) > 0)) audio.muted = true;
    // 방금 만든 음성의 실제 길이로 챕터 표를 다시 받는다(만들기 전에는 글자 수로 어림했다)
    const seq = loadSeq.current;
    const file = fileRef.current;
    const settle = (chs: Chapter[]) => {
      // 그사이 다른 파일을 걸었으면 그 파일이 따로 처리한다(기다리는 이동·소리 죽임도 그 파일 것)
      if (fileRef.current !== file) return;
      if (seq !== loadSeq.current) {
        // 목록·목소리를 바꾸는 중이다(곧 새 파일을 건다). 기다리던 이동만 비워 timeupdate가 다시 돌게 한다
        pendingRef.current = null;
        audio.muted = false;
        return;
      }
      apply(chs);
    };
    fetchEpisode(refresh.persona, refresh.voice, refresh.ids ?? undefined)
      .then((ep) => {
        if (seq === loadSeq.current) setEpisode(ep);
        settle(ep.chapters);
      })
      .catch(() => settle(chapters));
  };

  const live = !idle;
  const api: PlayerApi = {
    enabled,
    ready: !!episode,
    starting,
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
    canPrev: cur >= 0 || prevIndex !== null,
    canNext: nextIndex !== null,
    firstIndex: playlist ? 0 : (resumeAt?.index ?? startIndex(chapters, readSet, skip)),
    skips: (id) => skip && readSet.has(id),
    canSeek: !!episode && cur >= 0 && status !== "done" && !preparing && live,
    toggle: () => (status === "playing" ? pause() : play()),
    play,
    pause,
    goTo: (index) => goTo(index),
    select: (index) => select(index),
    playOne,
    seek,
    seekTo,
    seekProgress,
    skipBy,
    cancel,
    retry,
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
    playToday,
    reorderPlaylist,
    removeFromPlayer,
    removedToday: removed,
    restoreToday,
    canRemove,
    addToPlayer,
    pending,
    inPlayer: (id) => !!playlist?.includes(id) || pending.some((x) => x.clusterId === id),
    canEdit,
  };

  // 잠금 화면·이어폰·안드로이드 알림 버튼(lib/native/media.ts). 핸들러는 늘 최신 api를 부르도록 ref로 넘긴다.
  // 안드로이드 앱은 듣는 동안 포그라운드 서비스를 띄운다. 멈추면 알림만 남고, 다 듣거나 오늘로 돌아오면 지운다
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  const mediaActionRef = useRef<(action: MediaAction, seekTime?: number) => void>((action, seekTime) => {
    const a = apiRef.current;
    switch (action) {
      case "play":
        return a.play();
      case "pause":
        return a.pause();
      case "previoustrack":
        return a.prev();
      case "nexttrack":
        return a.next();
      case "seekbackward":
        return a.skipBy(-15000);
      case "seekforward":
        return a.skipBy(15000);
      case "seekto": {
        if (seekTime === undefined) return;
        // 잠금 화면의 시각은 지금 걸린 파일 안의 시각이다(첫 소식만 먼저 들을 때는 그 소식 파일)
        const l = leadRef.current;
        return a.seekTo((l ? (a.chapters[l.index]?.startMs ?? 0) : 0) + seekTime * 1000);
      }
    }
  });
  const title = chapters[cur]?.title;
  const mediaTitle = title ?? (playlist ? `플레이리스트 ${chapters.length || playlist.length}개` : `오늘 ${chapters.length}개 이어 듣기`);
  const mediaAlbum = playlist ? "플레이리스트" : "오늘 소식";
  // 플레이리스트 다음 묶음으로 넘어가는 동안에는 챕터 표가 잠깐 비어도 그대로 띄워 둔다
  const active = (!!episode || !!playlist) && (status === "playing" || status === "paused");
  useEffect(() => {
    if (!active) return hideMedia("player");
    const audio = audioRef.current;
    showMedia(
      "player",
      {
        title: mediaTitle,
        album: mediaAlbum,
        playing: status === "playing",
        position: audio?.currentTime ?? 0,
        duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
        rate,
      },
      (action, seekTime) => mediaActionRef.current(action, seekTime),
    );
  }, [active, status, mediaTitle, mediaAlbum, rate, seeks]);
  useEffect(() => () => hideMedia("player"), []);

  return (
    <PlayerContext.Provider value={api}>
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => {
          setStatus("playing");
          // 글 하나 듣기가 돌고 있으면 멈춘다(두 소리가 겹치지 않게)
          window.dispatchEvent(new CustomEvent(ITEM_PLAY_EVENT, { detail: -1 }));
        }}
        onPause={(e) => {
          const audio = e.currentTarget;
          // 끝까지 들어 멈춘 거면 ended에서 정한다(다음 파일로 이어 가는 동안 '멈춤'이 되면 알림·포그라운드 서비스가 내려간다)
          if (audio.ended) return;
          setStatus((s) => (s === "done" || s === "idle" ? s : "paused"));
          // 멈춘 자리를 바로 남긴다(파일이 열려 있고 옮겨 갈 자리를 기다리는 중이 아닐 때만)
          if (audio.readyState < 1 || pendingRef.current) return;
          const l = leadRef.current;
          if (l) return remember(l.clusterId, audio.currentTime * 1000, true);
          const ms = audio.currentTime * 1000;
          // 끝까지 들어 멈춘 거면(다 들음) 남기지 않는다
          if (needsFile() || ms >= (chapters.at(-1)?.endMs ?? 0) - 1000) return;
          const ch = chapters[Math.min(chapterAt(chapters, ms), chapters.length - 1)];
          if (ch) remember(ch.clusterId, Math.max(0, ms - ch.startMs), true);
        }}
        onSeeked={() => setSeeks((n) => n + 1)}
        onEnded={(e) => {
          // 끝나는 순간 다른 파일로 바꿔 끼웠으면(묶음 넘김) 지난 파일의 끝은 무시한다
          if (!e.currentTarget.ended) return;
          const l = leadRef.current;
          if (l) return leadEnded(l);
          if (continueQueue()) return;
          finish(false);
        }}
        onError={(e) => {
          const audio = e.currentTarget;
          if (!audio.getAttribute("src")) return;
          stopWait();
          if (preparing) void ttsErrorMessage().then(setError);
          else setError(FILE_ERROR);
          setPreparing(false);
          setLead(null);
          pendingRef.current = null;
          refreshRef.current = null;
          audio.muted = false;
          audio.pause();
          // 실패한 파일은 떼어 내서 다음 재생 때 다시 만들게 한다
          audio.removeAttribute("src");
          // 실패하면 pause 이벤트 없이 멈추므로 직접 바꾼다('듣는 중 0:00'으로 남지 않게. 잠금 화면·알림도 이 상태를 따른다)
          setStatus(cur >= 0 ? "paused" : "idle");
        }}
        hidden
      />
      <audio
        ref={waitRef}
        src={waitUrl(voice)}
        // 듣기를 쓸 수 있는 사람만 미리 받아 둔다(탭하자마자 나오게)
        preload={profile.audio ? "auto" : "none"}
        // 안내를 다 들었는데 본 소리가 멈춰 있으면(iOS가 안내를 틀며 멈춘 경우) 다시 건다. 사용자가 멈췄으면 stopWait가 꺼 둔다
        onEnded={endWait}
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
