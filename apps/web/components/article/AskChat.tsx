"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { ASK_CHIPS, ASK_DAILY, ASK_TEXT_MAX, type AskTurn } from "@/lib/ask";
import { withBase } from "@/lib/base-path";
import type { FeedItem } from "@/lib/types";

// 맹고 AI 대화(2026-11-03). 글 화면 오른쪽 아래 맹고 AI 버튼(AskDock.tsx)이 웹은 창, 앱은 시트로 연다.
// 이 소식에 대해서만 묻고 답한다(관계없는 질문은 서버가 정해 둔 답으로 막는다, lib/server/ask.ts).
// 대화는 이 탭에서만 기억한다(sessionStorage, 창을 닫거나 옆 글로 넘겼다 돌아와도 남게). 서버는 저장하지 않는다.
// 이어서 물을 때 앞선 대화를 같이 보내되, 소식과 관계없어 막힌 질문·답은 빼고 보낸다.

type Message = AskTurn & { id: number; offTopic?: boolean };
type Problem = "daily_limit" | "failed";

// 글마다 대화(JSON 글). 메모리가 먼저고, sessionStorage는 새로 불러왔을 때를 위해 같이 쓴다(막힌 브라우저는 메모리에만)
const memory = new Map<number, string>();
const listeners = new Set<() => void>();
const storageKey = (clusterId: number) => `maengo.ask.${clusterId}`;

function readRaw(clusterId: number): string {
  const hit = memory.get(clusterId);
  if (hit !== undefined) return hit;
  try {
    return sessionStorage.getItem(storageKey(clusterId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Message[] {
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as Message[]) : [];
  } catch {
    return [];
  }
}

function write(clusterId: number, messages: Message[]) {
  const raw = JSON.stringify(messages.slice(-20));
  memory.set(clusterId, raw);
  try {
    sessionStorage.setItem(storageKey(clusterId), raw);
  } catch {
    // 사생활 보호 모드 등은 메모리에만
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * window: 웹의 떠 있는 창. 창 높이를 나눠 쓰고 대화만 스크롤한다.
 * sheet: 앱의 아래 시트. 시트는 내용만큼 올라오고(최대 85%), 대화가 길면 대화만 스크롤한다(시트 끌기는 막는다)
 */
export function AskChat({ item, variant }: { item: Pick<FeedItem, "clusterId" | "category">; variant: "window" | "sheet" }) {
  const profile = useProfile();
  const id = item.clusterId;
  // 서버에서는 빈 대화로 그리고, 붙은 뒤 이 탭에 남은 대화를 읽는다
  const raw = useSyncExternalStore(subscribe, () => readRaw(id), () => "[]");
  const messages = useMemo(() => parse(raw), [raw]);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** 열 때는 바로, 이번에 물은 뒤로는 부드럽게 맨 아래로 */
  const smooth = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth.current && !reduce ? "smooth" : "auto" });
  }, [messages.length, waiting]);

  // 데스크톱은 열자마자 적을 수 있게. 휴대폰은 자판이 화면을 가리지 않게 누를 때까지 둔다
  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) inputRef.current?.focus();
  }, []);

  const push = (m: Omit<Message, "id">) => {
    const list = parse(readRaw(id));
    write(id, [...list, { ...m, id: list.reduce((n, x) => Math.max(n, x.id), 0) + 1 }]);
  };

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || waiting) return;
    setProblem(null);
    setWaiting(true);
    smooth.current = true;
    const history: AskTurn[] = [];
    // 막힌 질문은 그 질문과 바로 뒤 정해 둔 답을 함께 뺀다
    messages.forEach((m, i) => {
      if (m.offTopic || messages[i + 1]?.offTopic) return;
      history.push({ role: m.role, text: m.text });
    });
    push({ role: "user", text: question });
    setText("");
    if (inputRef.current) inputRef.current.style.height = "";
    // 휴대폰은 자판을 내려 답이 보이게
    if (!window.matchMedia("(hover: hover)").matches) inputRef.current?.blur();
    try {
      const res = await fetch(withBase("/api/ask"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clusterId: id, question, history }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; related?: boolean; error?: string };
      if (!res.ok || typeof data.answer !== "string") throw new Error(data.error ?? "failed");
      push({ role: "model", text: data.answer, offTopic: data.related === false });
      track("ask", { category: item.category, action: data.related === false ? "off_topic" : "answered" });
    } catch (e) {
      // 답을 못 받은 질문은 지우고 입력칸에 돌려놓는다
      write(id, parse(readRaw(id)).slice(0, -1));
      setText(question);
      const limit = (e as Error).message === "daily_limit";
      setProblem(limit ? "daily_limit" : "failed");
      track("ask", { category: item.category, action: limit ? "limit" : "error" });
    } finally {
      setWaiting(false);
    }
  }

  const empty = messages.length === 0 && !waiting;
  const sheet = variant === "sheet";

  return (
    <div className={`flex flex-col ${sheet ? "" : "min-h-0 flex-1"}`}>
      <div
        ref={listRef}
        data-no-sheet-drag={sheet || undefined}
        className={`overflow-y-auto overscroll-contain ${sheet ? "max-h-[calc(85dvh-190px)]" : "min-h-0 flex-1 px-4 py-4"}`}
      >
        {empty ? (
          <div className="flex flex-wrap gap-2">
            {ASK_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => ask(c)}
                className="min-h-11 rounded-full border-2 border-line bg-paper px-4 text-[14px] font-bold hover:border-mango hover:bg-mango-tint"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <ol aria-live="polite" className="flex flex-col gap-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-mango-tint px-4 py-2.5 text-[15px] font-semibold leading-relaxed">
                    {m.text}
                  </p>
                </li>
              ) : (
                <li key={m.id} className="flex items-start gap-2">
                  <Mascot className="size-9 shrink-0" />
                  <p
                    className={`min-w-0 max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border-2 border-line bg-paper px-4 py-2.5 text-[15px] font-medium leading-[1.7] ${m.offTopic ? "text-sub" : ""}`}
                  >
                    {m.text}
                  </p>
                </li>
              ),
            )}
            {waiting && (
              <li className="flex items-start gap-2">
                <Mascot className="size-9 shrink-0" />
                <span role="status" aria-label="답을 쓰는 중" className="flex gap-1 rounded-2xl rounded-tl-md border-2 border-line bg-paper px-4 py-4">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-1.5 rounded-full bg-faint motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </li>
            )}
          </ol>
        )}
      </div>

      <div className={sheet ? "pt-3" : "border-t-2 border-line p-3"}>
        {problem && (
          <p role="alert" className="mb-2 text-[14px] font-bold text-cherry">
            {problem === "failed" ? (
              "답하지 못했어요. 잠시 뒤 다시 물어봐 주세요."
            ) : profile.plan === "free" ? (
              <>
                오늘은 다 물어봤어요.{" "}
                <Link href="/premium" className="text-sky-dark underline underline-offset-2">
                  Premium은 하루 {ASK_DAILY.plus}번
                </Link>
              </>
            ) : (
              "오늘은 다 물어봤어요. 내일 다시 물어봐 주세요."
            )}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="ask-text" className="sr-only">
            이 소식에 대해 물어볼 말
          </label>
          <textarea
            id="ask-text"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={ASK_TEXT_MAX}
            enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              // 데스크톱: 엔터로 보내고 Shift+엔터로 줄바꿈. 한글 조합 중 엔터는 보내지 않는다
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
                e.preventDefault();
                void ask(text);
              }
            }}
            placeholder="이 소식에 대해 물어보세요"
            className="tile max-h-[120px] min-h-12 flex-1 resize-none px-4 py-3 text-[16px] font-semibold leading-snug placeholder:text-faint"
          />
          <button type="submit" disabled={waiting || !text.trim()} aria-label={waiting ? "답을 기다리는 중" : undefined} className="btn min-h-12 shrink-0 px-5 text-[15px]">
            {waiting ? <Spinner /> : "보내기"}
          </button>
        </form>
      </div>
    </div>
  );
}
