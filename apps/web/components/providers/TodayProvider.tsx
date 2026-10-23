"use client";

import { track } from "@/lib/analytics";
import type { FeedbackKind } from "@maengo/core/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/providers/ProfileProvider";
import { withBase } from "@/lib/base-path";
import type { TodayData } from "@/lib/types";

interface Game {
  /** 읽었거나 들은 항목 수 */
  done: number;
  total: number;
  /** 오늘 소식을 전부 봤는지 */
  allDone: boolean;
}

interface TodayApi {
  data: TodayData;
  read: ReadonlySet<number>;
  listened: ReadonlySet<number>;
  feedback: Readonly<Record<number, FeedbackKind>>;
  /** 읽었거나 들은 항목 */
  consumed: (clusterId: number) => boolean;
  game: Game;
  markRead: (clusterId: number) => void;
  markListened: (clusterId: number) => void;
  setFeedback: (clusterId: number, kind: FeedbackKind | null) => void;
  /**
   * '이 글 듣기'를 쓸 수 있는지: 'plan'(Premium), 'free'(Free의 오늘 듣기 몫, 2026-10-23), null(잠금).
   * 서버(lib/server/listen-access.ts)와 같은 규칙: 전에 들은 소식은 늘 되고, 처음 듣는 소식은 오늘 들은 수가 하루 몫보다 적을 때
   */
  listenAccess: (clusterId: number) => "plan" | "free" | null;
}

const TodayContext = createContext<TodayApi | null>(null);

function post(url: string, body: unknown) {
  // 페이지를 떠나는 순간(원문 보기)에도 기록이 남도록 keepalive
  fetch(withBase(url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

/** 오늘 피드와 읽음·들음·의견 상태. (app) 레이아웃에 있어 화면을 옮겨도 유지된다. */
export function TodayProvider({ initial, children }: { initial: TodayData; children: React.ReactNode }) {
  const [read, setRead] = useState(() => new Set(initial.read));
  const profile = useProfile();
  const [listened, setListened] = useState(() => new Set(initial.listened));
  const [listenedToday, setListenedToday] = useState(() => new Set(initial.listenedToday));
  // markListened가 '처음 듣는 소식'인지 볼 때 쓴다(다시 듣는 건 오늘 몫에 세지 않는다)
  const listenedRef = useRef(listened);
  useEffect(() => {
    listenedRef.current = listened;
  }, [listened]);
  const [feedback, setFeedbackState] = useState(initial.feedback);
  // 피드가 바뀌면(하나 더 받기·날짜가 바뀜) 서버 값과 합친다. key로 새로 만들면 안쪽 플레이어(<audio>)까지 새로 만들어져 재생이 끊긴다
  const [signature, setSignature] = useState(initial.signature);
  if (signature !== initial.signature) {
    setSignature(initial.signature);
    setRead((prev) => new Set([...prev, ...initial.read]));
    setListened((prev) => new Set([...prev, ...initial.listened]));
    setListenedToday((prev) => new Set([...prev, ...initial.listenedToday]));
    setFeedbackState((prev) => ({ ...initial.feedback, ...prev }));
  }

  const markRead = useCallback((id: number) => {
    setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    post("/api/reads", { clusterId: id, read: true });
  }, []);

  const markListened = useCallback((id: number) => {
    if (!listenedRef.current.has(id)) setListenedToday((prev) => new Set(prev).add(id));
    setListened((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    post("/api/reads", { clusterId: id, listened: true });
  }, []);

  const setFeedback = useCallback((id: number, kind: FeedbackKind | null) => {
    track("feedback", { kind: kind ?? "clear" });
    setFeedbackState((prev) => {
      const next = { ...prev };
      if (kind) next[id] = kind;
      else delete next[id];
      return next;
    });
    post("/api/feedback", { clusterId: id, kind });
  }, []);

  const value = useMemo<TodayApi>(() => {
    const consumed = (id: number) => read.has(id) || listened.has(id);
    const ids = initial.items.map((i) => i.clusterId);
    const done = ids.filter(consumed).length;
    const allDone = ids.length > 0 && done === ids.length;
    const listenAccess = (id: number) =>
      profile.audio ? "plan" : profile.dailyListens > 0 && (listened.has(id) || listenedToday.size < profile.dailyListens) ? "free" : null;
    return {
      // 서버가 다시 렌더링하면(플랜 전환 등) 새 피드 내용을 그대로 쓴다
      data: initial,
      read,
      listened,
      feedback,
      consumed,
      game: { done, total: ids.length, allDone },
      markRead,
      markListened,
      setFeedback,
      listenAccess,
    };
  }, [initial, read, listened, listenedToday, feedback, markRead, markListened, setFeedback, profile.audio, profile.dailyListens]);

  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
}

export function useToday(): TodayApi {
  const ctx = useContext(TodayContext);
  if (!ctx) throw new Error("useToday는 TodayProvider 안에서만 쓸 수 있어요");
  return ctx;
}
