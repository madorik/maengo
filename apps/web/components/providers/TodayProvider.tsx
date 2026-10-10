"use client";

import type { FeedbackKind } from "@maengo/core/types";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
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
}

const TodayContext = createContext<TodayApi | null>(null);

function post(url: string, body: unknown) {
  // 페이지를 떠나는 순간(원문 보기)에도 기록이 남도록 keepalive
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

/** 오늘 피드와 읽음·들음·의견 상태. (app) 레이아웃에 있어 화면을 옮겨도 유지된다. */
export function TodayProvider({ initial, children }: { initial: TodayData; children: React.ReactNode }) {
  const [read, setRead] = useState(() => new Set(initial.read));
  const [listened, setListened] = useState(() => new Set(initial.listened));
  const [feedback, setFeedbackState] = useState(initial.feedback);

  const markRead = useCallback((id: number) => {
    setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    post("/api/reads", { clusterId: id, read: true });
  }, []);

  const markListened = useCallback((id: number) => {
    setListened((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    post("/api/reads", { clusterId: id, listened: true });
  }, []);

  const setFeedback = useCallback((id: number, kind: FeedbackKind | null) => {
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
    };
  }, [initial, read, listened, feedback, markRead, markListened, setFeedback]);

  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
}

export function useToday(): TodayApi {
  const ctx = useContext(TodayContext);
  if (!ctx) throw new Error("useToday는 TodayProvider 안에서만 쓸 수 있어요");
  return ctx;
}
